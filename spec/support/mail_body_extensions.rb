# frozen_string_literal: true

module MailBodyExtensions
  def decoded(*_args)
    if multipart?
      html = parts.find { |p| p.content_type&.include?("text/html") }
      return html.decoded if html

      parts.map(&:decoded).join("\n")
    else
      super()
    end
  end

  def to_s(encoding = "utf-8")
    decoded(encoding)
  end

  def encoded(*_args)
    if multipart?
      decoded
    else
      super()
    end
  end

  def include?(*args)
    return super unless multipart?

    parts.any? { |p| p.decoded.include?(*args) } || sanitized.include?(*args) || CGI.unescapeHTML(decoded).include?(*args)
  end

  def match(*args)
    return super unless multipart?

    parts.find { |p| p.decoded.match(*args) }&.decoded&.match(*args) || sanitized.match(*args) || CGI.unescapeHTML(decoded).match(*args)
  end

  def match?(*args)
    return super unless multipart?

    parts.any? { |p| p.decoded.match?(*args) } || sanitized.match?(*args) || CGI.unescapeHTML(decoded).match?(*args)
  end

  def sanitized
    raw = multipart? ? parts.map(&:decoded).join(" ") : decoded
    @_sanitized ||= ActionView::Base.full_sanitizer
      .sanitize(raw)
      .gsub("\r\n", " ")
      .gsub(/\s{2,}/, " ")
  end
end

# Prepend to Mail::Body so overrides take precedence
Mail::Body.prepend(MailBodyExtensions)

module MailMessageExtensions
  def decoded
    if multipart?
      html = parts.find { |p| p.content_type&.include?("text/html") }
      return html.decoded if html

      parts.map(&:decoded).join("\n")
    else
      super
    end
  end
end

Mail::Message.prepend(MailMessageExtensions)

Rails.application.reload_routes_unless_loaded
