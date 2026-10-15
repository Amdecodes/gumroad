# frozen_string_literal: true

class Admin::ActivityLogsController < Admin::BaseController
  include Pagy::Backend

  LOGS_PER_PAGE = 25

  def index
    query_str = params[:q].to_s.strip
    action_filter = params[:action_name].to_s.strip.presence || params[:action_filter].to_s.strip.presence
    actor_filter = params[:actor].to_s.strip.presence
    status_filter = params[:status].to_s.strip.presence

    relation = AdminApiAuditLog.all

    if query_str.present?
      relation = relation.left_joins(:actor_user).where(
        "admin_api_audit_logs.action LIKE :q OR admin_api_audit_logs.target_type LIKE :q OR " \
        "admin_api_audit_logs.target_external_id LIKE :q OR admin_api_audit_logs.route LIKE :q OR " \
        "users.email LIKE :q OR users.username LIKE :q OR users.name LIKE :q",
        q: "%#{query_str}%"
      )
    end

    relation = relation.where(action: action_filter) if action_filter.present?

    if actor_filter.present?
      relation = relation.left_joins(:actor_user).where(
        "users.external_id = :a OR users.id = :aid OR admin_api_audit_logs.actor_user_id = :aid",
        a: actor_filter,
        aid: actor_filter.to_i
      )
    end

    if status_filter == "success"
      relation = relation.where(response_status: 200..299, error_class: nil)
    elsif status_filter == "failure"
      relation = relation.where(
        "admin_api_audit_logs.response_status NOT BETWEEN 200 AND 299 OR admin_api_audit_logs.error_class IS NOT NULL"
      )
    end

    relation = relation.includes(:actor_user).order(created_at: :desc, id: :desc)

    @pagy, @logs = pagy(relation, limit: LOGS_PER_PAGE)

    serialized_logs = @logs.map { serialize_log_summary(_1) }

    available_actions = AdminApiAuditLog.distinct.order(:action).pluck(:action)
    available_actors = User.where(id: AdminApiAuditLog.distinct.select(:actor_user_id)).map do |user|
      {
        id: user.external_id,
        name: user.name.presence || user.username.presence || user.email,
        email: user.email
      }
    end

    render inertia: "Admin/ActivityLog/Index", props: {
      logs: serialized_logs,
      pagy: {
        page: @pagy.page,
        pages: @pagy.pages,
        count: @pagy.count,
        next_page: @pagy.next,
        prev_page: @pagy.prev,
        has_more: @pagy.next.present?
      },
      available_actions:,
      available_actors:,
      filters: {
        q: query_str.presence,
        action_name: action_filter,
        actor: actor_filter,
        status: status_filter
      },
      current_admin: current_admin_props
    }
  end

  def show
    log = AdminApiAuditLog.includes(:actor_user, :admin_api_token).find_by(id: params[:id])

    if log.blank?
      if request.inertia? || request.format.html?
        render file: Rails.public_path.join("404.html"), status: :not_found, layout: false
      else
        render json: { success: false, message: t("admin.activity_log_not_found", default: "Activity log not found") }, status: :not_found
      end
      return
    end

    serialized = serialize_log_detail(log)

    if request.inertia? || request.format.html?
      render inertia: "Admin/ActivityLog/Show", props: {
        log: serialized,
        current_admin: current_admin_props
      }
    else
      render json: { success: true, log: serialized }
    end
  end

  private
    def serialize_log_summary(log)
      status_label = log.response_status&.between?(200, 299) && log.error_class.blank? ? "success" : "failure"

      {
        id: log.id.to_s,
        action: log.action,
        humanized_action: humanize_action(log.action),
        actor: {
          id: log.actor_user&.external_id,
          name: log.actor_user&.name.presence || log.actor_user&.username.presence || log.actor_user&.email || "System",
          email: log.actor_user&.email
        },
        target_type: log.target_type,
        target_id: log.target_id&.to_s,
        target_external_id: log.target_external_id,
        target_link: target_link_for(log),
        route: log.route,
        http_method: log.http_method,
        response_status: log.response_status,
        status: status_label,
        error_class: log.error_class,
        created_at: log.created_at.as_json,
        formatted_created_at: log.created_at.strftime("%b %d, %Y %H:%M:%S UTC")
      }
    end

    def serialize_log_detail(log)
      summary = serialize_log_summary(log)
      summary.merge(
        request_id: log.request_id,
        params_snapshot: log.params_snapshot || {},
        token: {
          external_id: log.admin_api_token&.external_id,
          scope: log.admin_api_token&.scope
        }
      )
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
