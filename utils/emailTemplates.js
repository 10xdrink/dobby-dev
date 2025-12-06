
/**
 * Generate password reset request email (Flipkart-style)
 * @param {string} customerName - Customer's first name
 * @param {string} resetLink - Password reset link with token
 * @param {string} expiryTime - Token expiry time (default: "1 hour")
 * @returns {string} HTML email content
 */
function generatePasswordResetEmail(customerName, resetLink, expiryTime = "1 hour") {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  
  <!-- Main Container -->
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        
        <!-- Email Card -->
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header with Brand Color -->
          <tr>
            <td style="background: linear-gradient(135deg, #2874f0 0%, #1e5bc6 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                🔐 Password Reset Request
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px 30px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.5;">
                Hi <strong>${customerName}</strong>,
              </p>
              
              <!-- Message -->
              <p style="margin: 0 0 20px; font-size: 15px; color: #555555; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password for your account.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" 
                       style="display: inline-block; 
                              background: linear-gradient(135deg, #2874f0 0%, #1e5bc6 100%); 
                              color: #ffffff; 
                              text-decoration: none; 
                              padding: 14px 40px; 
                              border-radius: 6px; 
                              font-size: 16px; 
                              font-weight: 600;
                              box-shadow: 0 4px 12px rgba(40, 116, 240, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry Notice -->
              <table role="presentation" style="width: 100%; margin: 25px 0; background-color: #fff8e1; border-left: 4px solid #ffc107; border-radius: 4px;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #856404; line-height: 1.5;">
                      ⏰ <strong>Important:</strong> This link will expire in <strong>${expiryTime}</strong>. Please reset your password before it expires.
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 25px 0 0; font-size: 13px; color: #777777; line-height: 1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all;">
                <a href="${resetLink}" style="color: #2874f0; text-decoration: none;">
                  ${resetLink}
                </a>
              </p>
              
            </td>
          </tr>
          
          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" style="width: 100%; background-color: #f8f9fa; border-radius: 6px; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #333333; font-weight: 600;">
                      🛡️ Security Tips
                    </p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #555555; line-height: 1.8;">
                      <li>Never share your password with anyone</li>
                      <li>Use a strong, unique password</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Didn't Request Section -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <table role="presentation" style="width: 100%; background-color: #fff3f3; border-left: 4px solid #f44336; border-radius: 4px;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0; font-size: 14px; color: #c62828; line-height: 1.5;">
                      <strong>⚠️ Didn't request this?</strong><br>
                      If you didn't request a password reset, please ignore this email or 
                      <a href="mailto:support@yourcompany.com" style="color: #c62828; font-weight: 600;">contact our support team</a> 
                      immediately. Your account is still secure.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e0e0e0;">
              
              <!-- Footer Text -->
              <p style="margin: 0 0 15px; font-size: 13px; color: #777777; line-height: 1.6; text-align: center;">
                Need help? Contact us at 
                <a href="mailto:support@yourcompany.com" style="color: #2874f0; text-decoration: none;">support@yourcompany.com</a>
              </p>
              
              
              
              <!-- Company Info -->
              <p style="margin: 15px 0 0; font-size: 12px; color: #999999; line-height: 1.5; text-align: center;">
                © 2025 Dobby Mall. All rights reserved.<br>
                123 Business Street, City, State 12345<br>
                
              </p>
              
            </td>
          </tr>
          
        </table>
        
        <!-- Footer Note -->
        <p style="margin: 20px 0 0; font-size: 12px; color: #999999; text-align: center; line-height: 1.5;">
          This is an automated email. Please do not reply to this message.<br>
          Add <a href="mailto:noreply@yourcompany.com" style="color: #2874f0; text-decoration: none;">noreply@yourcompany.com</a> to your contacts to ensure delivery.
        </p>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}

/**
 * Generate password reset success confirmation email
 * @param {string} customerName - Customer's first name
 * @param {string} resetTime - Formatted date/time of password reset
 * @param {string} ipAddress - IP address used for reset
 * @returns {string} HTML email content
 */
function generatePasswordResetSuccessEmail(customerName, resetTime, ipAddress) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header with Success Color -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">
                ✅ Password Reset Successful
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px 30px;">
              
              <p style="margin: 0 0 20px; font-size: 16px; color: #333333; line-height: 1.5;">
                Hi <strong>${customerName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; font-size: 15px; color: #555555; line-height: 1.6;">
                Your password has been successfully reset. You can now log in to your account using your new password.
              </p>
              
              <!-- Success Box -->
              <table role="presentation" style="width: 100%; margin: 25px 0; background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; font-size: 14px; color: #2e7d32; font-weight: 600;">
                      ✓ Password Reset Confirmed
                    </p>
                    <table style="width: 100%; font-size: 13px; color: #555555;">
                      <tr>
                        <td style="padding: 4px 0;"><strong>Date & Time:</strong></td>
                        <td style="padding: 4px 0;">${resetTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0;"><strong>IP Address:</strong></td>
                        <td style="padding: 4px 0;">${ipAddress}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Login Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="https://yourapp.com/login" 
                       style="display: inline-block; 
                              background: linear-gradient(135deg, #2874f0 0%, #1e5bc6 100%); 
                              color: #ffffff; 
                              text-decoration: none; 
                              padding: 14px 40px; 
                              border-radius: 6px; 
                              font-size: 16px; 
                              font-weight: 600;
                              box-shadow: 0 4px 12px rgba(40, 116, 240, 0.3);">
                      Login to Your Account
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Security Alert -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <table role="presentation" style="width: 100%; background-color: #fff3f3; border-left: 4px solid #f44336; border-radius: 4px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 10px; font-size: 14px; color: #c62828; font-weight: 600;">
                      ⚠️ Didn't make this change?
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #c62828; line-height: 1.6;">
                      If you didn't reset your password, your account may be compromised. Please 
                      <a href="mailto:support@yourcompany.com" style="color: #c62828; font-weight: 600;">contact our support team</a> 
                      immediately to secure your account.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #777777; line-height: 1.6;">
                Need help? Contact us at 
                <a href="mailto:support@yourcompany.com" style="color: #2874f0; text-decoration: none;">support@yourcompany.com</a>
              </p>
              <p style="margin: 15px 0 0; font-size: 12px; color: #999999; line-height: 1.5;">
                © 2025 Dobby Mall. All rights reserved.<br>
                
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}

// Export both template functions
module.exports = {
  generatePasswordResetEmail,
  generatePasswordResetSuccessEmail,
};