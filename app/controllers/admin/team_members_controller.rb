# frozen_string_literal: true

class Admin::TeamMembersController < Admin::BaseController
  include Pagy::Backend

  layout "inertia"

  MEMBERS_PER_PAGE = 25

  before_action :fetch_member, only: [:show, :revoke]

  def index
    query_str = params[:q].to_s.strip

    relation = User.where("users.flags & ? != 0", User.flag_mapping["flags"][:is_team_member])

    if query_str.present?
      relation = relation.where(
        "users.email LIKE :q OR users.username LIKE :q OR users.name LIKE :q",
        q: "%#{query_str}%"
      )
    end

    relation = relation.order(id: :asc)

    @pagy, @members = pagy(relation, limit: MEMBERS_PER_PAGE)

    member_ids = @members.map(&:id)
    counts_by_user = AdminApiAuditLog.where(actor_user_id: member_ids).group(:actor_user_id).count
    latest_by_user = AdminApiAuditLog.where(actor_user_id: member_ids).group(:actor_user_id).maximum(:created_at)

    serialized_members = @members.map do |member|
      is_root = member.gumroad_account?
      is_current = member.id == current_user.id
      role_label = is_root ? "Platform Owner" : "Staff Member"

      {
        id: member.external_id,
        username: member.username,
        name: member.name.presence || member.username.presence || member.email,
        email: member.email,
        avatar_url: member.avatar_url,
        is_root_account: is_root,
        is_current_user: is_current,
        role_label:,
        joined_at: member.created_at.as_json,
        formatted_joined_at: member.created_at.strftime("%b %d, %Y"),
        actions_count: counts_by_user[member.id] || 0,
        last_active_at: latest_by_user[member.id]&.as_json,
        formatted_last_active_at: latest_by_user[member.id]&.strftime("%b %d, %Y %H:%M UTC") || "Never",
        can_revoke: !is_root && !is_current
      }
    end

    render inertia: "Admin/Team/Index", props: {
      team_members: serialized_members,
      pagy: {
        page: @pagy.page,
        pages: @pagy.pages,
        count: @pagy.count,
        next_page: @pagy.next,
        prev_page: @pagy.prev,
        has_more: @pagy.next.present?
      },
      filters: {
        q: query_str.presence
      },
      current_admin: current_admin_props
    }
  end

  def show
    is_root = @member.gumroad_account?
    is_current = @member.id == current_user.id
    role_label = is_root ? "Platform Owner" : "Staff Member"
    can_revoke = !is_root && !is_current

    actions_count = AdminApiAuditLog.where(actor_user_id: @member.id).count
    first_action_at = AdminApiAuditLog.where(actor_user_id: @member.id).minimum(:created_at)
    latest_action_at = AdminApiAuditLog.where(actor_user_id: @member.id).maximum(:created_at)

    recent_actions = AdminApiAuditLog.where(actor_user_id: @member.id)
                                    .order(created_at: :desc, id: :desc)
                                    .limit(20)
                                    .map { serialize_member_audit_log(_1) }

    render inertia: "Admin/Team/Show", props: {
      member: {
        id: @member.external_id,
        username: @member.username,
        name: @member.name.presence || @member.username.presence || @member.email,
        email: @member.email,
        avatar_url: @member.avatar_url,
        bio: @member.bio,
        is_root_account: is_root,
        is_current_user: is_current,
        role_label:,
        joined_at: @member.created_at.as_json,
        formatted_joined_at: @member.created_at.strftime("%B %d, %Y"),
        two_factor_enabled: @member.two_factor_authentication_enabled?,
        confirmed: @member.confirmed?,
        can_revoke:
      },
      stats: {
        actions_count:,
        first_action_at: first_action_at&.as_json,
        latest_action_at: latest_action_at&.as_json,
        formatted_latest_action_at: latest_action_at&.strftime("%b %d, %Y %H:%M UTC") || "Never"
      },
      recent_actions:,
      impersonate_url: "/admin/impersonate?user_id=#{@member.external_id}",
      current_admin: current_admin_props
    }
  end

  def revoke
    if @member.id == current_user.id
      message = "You cannot revoke your own staff access."
      if request.inertia? || request.format.html?
        redirect_to admin_team_member_path(@member.external_id), alert: message
      else
        render json: { success: false, message: }, status: :unprocessable_entity
      end
      return
    end

    if @member.gumroad_account?
      message = "The platform owner root account cannot be revoked."
      if request.inertia? || request.format.html?
        redirect_to admin_team_member_path(@member.external_id), alert: message
      else
        render json: { success: false, message: }, status: :unprocessable_entity
      end
      return
    end

    reason = params[:reason].to_s.strip
    note = "Admin staff access revoked by #{current_user.name.presence || current_user.email}."
    note += " Reason: #{reason}" if reason.present?

    # Dispatch audit trail through InternalApiCaller to record exact AdminApiAuditLog
    result = Admin::InternalApiCaller.call(
      admin_user: current_user,
      method: :post,
      path: "/internal/admin/users/create_comment",
      params: {
        user_id: @member.external_id,
        content: note,
        idempotency_key: SecureRandom.hex(16)
      }
    )

    if result.success?
      User.transaction do
        @member.update!(is_team_member: false)
        root_seller = User.find_by(email: ApplicationMailer::ADMIN_EMAIL)
        if root_seller
          @member.user_memberships.not_deleted.where(seller: root_seller).each(&:update_as_deleted!)
        end
      end

      success_message = "Staff access for #{@member.name.presence || @member.username} was revoked successfully."
      if request.inertia? || request.format.html?
        redirect_to admin_team_members_path, notice: success_message
      else
        render json: { success: true, message: success_message }
      end
    else
      error_message = result.error_message
      if request.inertia? || request.format.html?
        redirect_to admin_team_member_path(@member.external_id), alert: error_message
      else
        render json: { success: false, message: error_message }, status: result.status
      end
    end
  end

  private
    def fetch_member
      identifier = params[:id].to_s.strip
      @member = User.where("users.flags & ? != 0", User.flag_mapping["flags"][:is_team_member])
                    .find_by(external_id: identifier) ||
                User.where("users.flags & ? != 0", User.flag_mapping["flags"][:is_team_member])
                    .find_by(username: identifier)

      return if @member.present?

      if request.inertia? || request.format.html?
        render file: Rails.public_path.join("404.html"), status: :not_found, layout: false
      else
        render json: { success: false, message: "Team member not found" }, status: :not_found
      end
    end

    def serialize_member_audit_log(log)
      status_label = log.response_status&.between?(200, 299) && log.error_class.blank? ? "success" : "failure"

      {
        id: log.id.to_s,
        action: log.action,
        humanized_action: humanize_action(log.action),
        target_type: log.target_type,
        target_external_id: log.target_external_id,
        target_link: target_link_for(log),
        route: log.route,
        response_status: log.response_status,
        status: status_label,
        created_at: log.created_at.as_json,
        formatted_created_at: log.created_at.strftime("%b %d, %Y %H:%M:%S UTC")
      }
    end

    def target_link_for(log)
      return nil if log.target_type.blank?

      target_ref = log.target_external_id.presence || log.target_id&.to_s
      return nil if target_ref.blank?

      case log.target_type
      when "User"
        "/admin/creators/#{target_ref}"
      when "Purchase"
        "/admin/orders/#{target_ref}"
      when "Payment", "ScheduledPayout"
        "/admin/payouts/#{target_ref}"
      end
    end

    def humanize_action(action)
      return "" if action.blank?

      action.to_s.split(".").map(&:humanize).join(" → ")
    end

    def current_admin_props
      {
        name: current_user.name.presence || current_user.username.presence || current_user.email,
        email: current_user.email,
        avatar_url: current_user.avatar_url
      }
    end
end
