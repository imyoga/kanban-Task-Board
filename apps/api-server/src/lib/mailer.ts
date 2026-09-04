import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMailerConfig() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!user) throw new Error("Missing SMTP_USER.");
  if (!pass) throw new Error("Missing SMTP app password.");
  if (!from) throw new Error("Missing SMTP_FROM.");

  return { user, pass, from };
}

function getTransporter() {
  if (transporter) return transporter;
  const { user, pass } = getMailerConfig();
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

function getClientOrigin() {
  const origin = process.env.CLIENT_ORIGIN;
  if (!origin) throw new Error("Missing CLIENT_ORIGIN.");
  return origin.replace(/\/$/, "");
}

export async function sendTeamInviteEmail({
  to,
  teamName,
  inviterEmail,
  inviteToken,
}: {
  to: string;
  teamName: string;
  inviterEmail: string;
  inviteToken: string;
}) {
  const { from } = getMailerConfig();
  const mailer = getTransporter();
  const base = getClientOrigin();
  const signupUrl = `${base}/?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(to)}`;
  const safeUrl = escapeHtml(signupUrl);
  const safeTeam = escapeHtml(teamName);
  const safeInviter = escapeHtml(inviterEmail);

  await mailer.sendMail({
    from,
    to,
    subject: `You're invited to join ${teamName} on Kanban`,
    text: [
      "Kanban team invitation",
      "",
      `${inviterEmail} invited you to join the team "${teamName}".`,
      "",
      `Create your account: ${signupUrl}`,
      "",
      "If the link does not open, copy and paste the full URL into your browser.",
    ].join("\n"),
    html: `
      <div style="margin:0; padding:32px 16px; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#1a2332;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dde3ea; border-radius:20px; overflow:hidden;">
          <div style="padding:24px 28px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#ffffff;">
            <div style="display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.18); font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
              Kanban
            </div>
            <h1 style="margin:16px 0 8px; font-size:28px; line-height:1.2; font-weight:800;">Join ${safeTeam}</h1>
            <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(255,255,255,0.92);">
              ${safeInviter} invited you to collaborate on their Kanban team.
            </p>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#334155;">
              Create your account to join the team and start working on shared boards.
            </p>
            <div style="margin:24px 0; text-align:center;">
              <a href="${safeUrl}" style="display:inline-block; background:#3b82f6; color:#ffffff; text-decoration:none; font-weight:800; font-size:15px; padding:14px 24px; border-radius:12px;">
                Accept invitation
              </a>
            </div>
            <div style="margin:24px 0; padding:16px; background:#f8fafc; border:1px solid #dde3ea; border-radius:14px;">
              <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">
                If the button does not open
              </p>
              <div style="word-break:break-all; font-size:14px; line-height:1.6; color:#1a2332; background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:12px;">
                ${safeUrl}
              </div>
            </div>
          </div>
          <div style="padding:18px 28px; border-top:1px solid #e2e8f0; background:#f8fafc; font-size:12px; line-height:1.6; color:#64748b;">
            Sent by Kanban Task Board
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendTeamAddedEmail({
  to,
  teamName,
  inviterEmail,
  boardName,
}: {
  to: string;
  teamName: string;
  inviterEmail: string;
  boardName?: string | null;
}) {
  const { from } = getMailerConfig();
  const mailer = getTransporter();
  const base = getClientOrigin();
  const safeTeam = escapeHtml(teamName);
  const safeInviter = escapeHtml(inviterEmail);
  const boardLine = boardName
    ? `You can now access the linked board "${boardName}".`
    : "Sign in to see your team boards.";

  await mailer.sendMail({
    from,
    to,
    subject: `You were added to ${teamName} on Kanban`,
    text: [
      "Kanban team notification",
      "",
      `${inviterEmail} added you to the team "${teamName}".`,
      boardLine,
      "",
      `Open Kanban: ${base}`,
    ].join("\n"),
    html: `
      <div style="margin:0; padding:32px 16px; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#1a2332;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dde3ea; border-radius:20px; overflow:hidden;">
          <div style="padding:24px 28px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#ffffff;">
            <div style="display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.18); font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
              Kanban
            </div>
            <h1 style="margin:16px 0 8px; font-size:28px; line-height:1.2; font-weight:800;">Welcome to ${safeTeam}</h1>
            <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(255,255,255,0.92);">
              ${safeInviter} added you to their team.
            </p>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#334155;">
              ${escapeHtml(boardLine)}
            </p>
            <div style="margin:24px 0; text-align:center;">
              <a href="${escapeHtml(base)}" style="display:inline-block; background:#3b82f6; color:#ffffff; text-decoration:none; font-weight:800; font-size:15px; padding:14px 24px; border-radius:12px;">
                Open Kanban
              </a>
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  resetToken,
  userName,
}: {
  to: string;
  resetToken: string;
  userName?: string | null;
}) {
  const { from } = getMailerConfig();
  const mailer = getTransporter();
  const base = getClientOrigin();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const safeUrl = escapeHtml(resetUrl);
  const safeName = userName ? escapeHtml(userName) : "there";

  await mailer.sendMail({
    from,
    to,
    subject: "Reset your Kanban password",
    text: [
      "Kanban password reset",
      "",
      `Hi ${safeName},`,
      "",
      "We received a request to reset your Kanban account password.",
      `Reset your password: ${resetUrl}`,
      "",
      "This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.",
      "",
      "If the link does not open, copy and paste the full URL into your browser.",
    ].join("\n"),
    html: `
      <div style="margin:0; padding:32px 16px; background:#f4f6f8; font-family:Arial,Helvetica,sans-serif; color:#1a2332;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dde3ea; border-radius:20px; overflow:hidden;">
          <div style="padding:24px 28px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color:#ffffff;">
            <div style="display:inline-block; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.18); font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
              Kanban
            </div>
            <h1 style="margin:16px 0 8px; font-size:28px; line-height:1.2; font-weight:800;">Reset your password</h1>
            <p style="margin:0; font-size:15px; line-height:1.6; color:rgba(255,255,255,0.92);">
              We received a request to reset your password.
            </p>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#334155;">
              Hi ${safeName}, click the button below to choose a new password for your account. This temporary link will expire in <strong>1 hour</strong>.
            </p>
            <div style="margin:24px 0; text-align:center;">
              <a href="${safeUrl}" style="display:inline-block; background:#3b82f6; color:#ffffff; text-decoration:none; font-weight:800; font-size:15px; padding:14px 24px; border-radius:12px;">
                Reset Password
              </a>
            </div>
            <p style="margin:16px 0 0; font-size:14px; line-height:1.6; color:#64748b;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
            <div style="margin:24px 0; padding:16px; background:#f8fafc; border:1px solid #dde3ea; border-radius:14px;">
              <p style="margin:0 0 10px; font-size:13px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.04em;">
                If the button does not open
              </p>
              <div style="word-break:break-all; font-size:14px; line-height:1.6; color:#1a2332; background:#ffffff; border:1px dashed #cbd5e1; border-radius:10px; padding:12px;">
                ${safeUrl}
              </div>
            </div>
          </div>
          <div style="padding:18px 28px; border-top:1px solid #e2e8f0; background:#f8fafc; font-size:12px; line-height:1.6; color:#64748b;">
            Sent by Kanban Task Board
          </div>
        </div>
      </div>
    `,
  });
}
