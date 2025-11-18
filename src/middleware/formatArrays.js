// Middleware to ensure product arrays are properly formatted in the response
export const formatProductArrays = (req, res, next) => {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method to format product arrays
  res.json = function(data) {
    // Check if the response contains products
    if (data && typeof data === 'object') {
      // Handle single product
      if (data.product) {
        formatProduct(data.product);
      }
      
      // Handle products array
      if (data.products && Array.isArray(data.products)) {
        data.products.forEach(formatProduct);
      }
      
      // Handle single product in other structures
      if (data.data && data.data.product) {
        formatProduct(data.data.product);
      }
      
      // Handle products array in other structures
      if (data.data && data.data.products && Array.isArray(data.data.products)) {
        data.data.products.forEach(formatProduct);
      }
    }
    
    // Call the original json method with formatted data
    return originalJson.call(this, data);
  };
  
  next();
};

// Helper function to format a single product
function formatProduct(product) {
  if (!product || typeof product !== 'object') return;
  
  // Process colors
  if (product.colors && typeof product.colors === 'string') {
    try {
      product.colors = JSON.parse(product.colors);
    } catch (e) {
      product.colors = product.colors.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  // Process sizes
  if (product.sizes && typeof product.sizes === 'string') {
    try {
      product.sizes = JSON.parse(product.sizes);
    } catch (e) {
      product.sizes = product.sizes.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  // Process scents
  if (product.scents && typeof product.scents === 'string') {
    try {
      product.scents = JSON.parse(product.scents);
    } catch (e) {
      product.scents = product.scents.replace(/\[|\]/g, '').split(',').map(item => item.trim().replace(/"/g, ''));
    }
  }
  
  // Ensure they are arrays
  if (!Array.isArray(product.colors)) product.colors = [];
  if (!Array.isArray(product.sizes)) product.sizes = [];
  if (!Array.isArray(product.scents)) product.scents = [];
}