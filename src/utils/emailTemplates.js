// Professional Email Templates for Shopverse
export const emailTemplates = {
  // Order Confirmation Email
  orderConfirmation: (data) => {
    const { customerName, orderId, totalAmount, paymentMethod, orderItems, orderDate } = data;
    
    const itemsHtml = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <div><strong>${item.name}</strong></div>
          ${item.selectedColor ? `<div style="color: #666; font-size: 14px;">Color: ${item.selectedColor}</div>` : ''}
          ${item.selectedSize ? `<div style="color: #666; font-size: 14px;">Size: ${item.selectedSize}</div>` : ''}
          ${item.selectedScent ? `<div style="color: #666; font-size: 14px;">Scent: ${item.selectedScent}</div>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - Shopverse</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Shopverse</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Order Confirmation</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
          
          <p>Thank you for your order! We're excited to let you know that your order has been successfully placed.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #444;">Order Details</h3>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Order Date:</strong> ${new Date(orderDate).toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          </div>
          
          <h3 style="color: #444;">Items Ordered</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #eee;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center;">
            <p style="margin-bottom: 20px;">You'll receive updates on your order status via email.</p>
            <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Track Your Order</a>
          </div>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            Thank you for shopping with Shopverse!<br>
            <strong>Shopverse Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Shopverse. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
  },

  // Invoice Email
  invoice: (data) => {
    const { customerName, invoiceNumber, orderId, totalAmount, paymentMethod, orderItems, orderDate, dueDate } = data;
    
    const itemsHtml = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <div><strong>${item.name}</strong></div>
          ${item.selectedColor ? `<div style="color: #666; font-size: 14px;">Color: ${item.selectedColor}</div>` : ''}
          ${item.selectedSize ? `<div style="color: #666; font-size: 14px;">Size: ${item.selectedSize}</div>` : ''}
          ${item.selectedScent ? `<div style="color: #666; font-size: 14px;">Scent: ${item.selectedScent}</div>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.lineTotal.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoiceNumber} - Shopverse</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Shopverse</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Official Invoice</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div>
              <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
              <p>Thank you for your purchase. Please find your invoice details below.</p>
            </div>
            <div style="text-align: right;">
              <h3 style="color: #444; margin: 0;">INVOICE</h3>
              <p style="margin: 5px 0;"><strong>Invoice #:</strong> ${invoiceNumber}</p>
              <p style="margin: 5px 0;"><strong>Order #:</strong> ${orderId}</p>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div>
              <h4 style="margin-top: 0; color: #444;">Order Date</h4>
              <p>${new Date(orderDate).toLocaleDateString()}</p>
            </div>
            <div>
              <h4 style="margin-top: 0; color: #444;">Payment Method</h4>
              <p>${paymentMethod}</p>
            </div>
            <div>
              <h4 style="margin-top: 0; color: #444;">Total Amount</h4>
              <p style="font-size: 20px; font-weight: bold; color: #667eea;">$${totalAmount.toFixed(2)}</p>
            </div>
            ${dueDate ? `
            <div>
              <h4 style="margin-top: 0; color: #444;">Due Date</h4>
              <p>${new Date(dueDate).toLocaleDateString()}</p>
            </div>
            ` : ''}
          </div>
          
          <h3 style="color: #444;">Items Purchased</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #eee;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #eee;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #eee;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; text-align: center;">
            <p style="margin-bottom: 20px;">Thank you for your business!</p>
            <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">Download Invoice</a>
          </div>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            Best regards,<br>
            <strong>The Shopverse Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Shopverse. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
  },

  // Order Status Update Email
  orderStatusUpdate: (data) => {
    const { customerName, orderId, oldStatus, newStatus, totalAmount, orderItems } = data;
    
    const statusColors = {
      'ORDER_PLACED': '#3498db',
      'PROCESSING': '#f39c12',
      'SHIPPED': '#9b59b6',
      'DELIVERED': '#27ae60',
      'CANCELLED': '#e74c3c'
    };

    const itemsHtml = orderItems.slice(0, 3).map(item => `
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <img src="${item.images && item.images[0] ? item.images[0] : 'https://via.placeholder.com/50'}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px;">
        <div>
          <div><strong>${item.name}</strong></div>
          <div style="color: #666; font-size: 14px;">Qty: ${item.quantity}</div>
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Status Update - Shopverse</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Shopverse</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Order Status Update</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hello ${customerName},</h2>
          
          <p>We're writing to inform you that the status of your order has been updated.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #444;">Order Status Changed</h3>
            <div style="display: flex; justify-content: center; align-items: center; margin: 20px 0;">
              <span style="background: ${statusColors[oldStatus] || '#95a5a6'}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px;">${oldStatus.replace('_', ' ')}</span>
              <span style="margin: 0 15px; font-size: 20px;">→</span>
              <span style="background: ${statusColors[newStatus] || '#95a5a6'}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px;">${newStatus.replace('_', ' ')}</span>
            </div>
            <p><strong>Order ID:</strong> ${orderId}</p>
            <p><strong>Total Amount:</strong> $${totalAmount.toFixed(2)}</p>
          </div>
          
          <h3 style="color: #444;">Items in Your Order</h3>
          <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${itemsHtml}
            ${orderItems.length > 3 ? `<p style="margin: 10px 0 0 0; color: #666;">+${orderItems.length - 3} more items</p>` : ''}
          </div>
          
          <div style="margin-top: 30px; text-align: center;">
            <p style="margin-bottom: 20px;">You'll receive further updates as your order progresses.</p>
            <a href="#" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">View Order Details</a>
          </div>
          
          <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            Thank you for shopping with Shopverse!<br>
            <strong>Shopverse Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Shopverse. All rights reserved.</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `;
  }
};