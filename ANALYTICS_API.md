# Analytics API Documentation

## Overview
This API provides comprehensive analytics and reporting capabilities for the e-commerce platform, including overall platform metrics, store-specific analytics, sales data, product performance metrics, and advanced visualization data.

## Base URL
```
/api/analytics
```

## Authentication
All endpoints require authentication. Admin endpoints require `admin` role, store endpoints require `store` role.

---

## Endpoints

### 1. Get Overall Analytics
**GET** `/api/analytics/overall`

**Description**: Retrieves comprehensive platform-wide analytics including key metrics, recent orders, top stores, and sales trends.

**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalStores": 15,
      "totalUsers": 1240,
      "totalProducts": 340,
      "totalCategories": 24,
      "totalOrders": 2156,
      "totalRevenue": 125000
    },
    "recentOrders": [...],
    "topStores": [...],
    "topProducts": [...],
    "ordersByDay": [...],
    "revenueByCategory": [...]
  }
}
```

---

### 2. Get Store Analytics
**GET** `/api/analytics/store`

**Description**: Retrieves analytics specific to the authenticated store owner, including store performance, top products, sales trends, quarterly reports, and market share data.

**Permissions**: Store owner only

**Response**:
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "store123",
      "name": "My Store",
      "username": "mystore"
    },
    "metrics": {
      "totalOrders": 142,
      "totalRevenue": 8500,
      "totalProducts": 25,
      "monthOverMonthGrowth": "12.5%"
    },
    "topProducts": [...],
    "ordersByDay": [...],
    "revenueByCategory": [...],
    "quarterlyReports": [...],
    "productPerformance": [...]
  }
}
```

---

### 3. Get Advanced Store Analytics
**GET** `/api/analytics/store/advanced`

**Description**: Retrieves advanced analytics with chart-ready data for the authenticated store owner, including revenue trends, product distribution, order volume, and customer acquisition.

**Permissions**: Store owner only

**Response**:
```json
{
  "success": true,
  "data": {
    "revenueTrend": {
      "labels": ["Jan 2023", "Feb 2023", ...],
      "datasets": [...]
    },
    "productSalesDistribution": {
      "labels": ["Product A", "Product B", ...],
      "datasets": [...]
    },
    "orderVolumeByDay": {
      "labels": ["Mon", "Tue", ...],
      "datasets": [...]
    },
    "customerAcquisition": {
      "labels": ["Jan 2023", "Feb 2023", ...],
      "datasets": [...]
    }
  }
}
```

---

### 4. Get Sales Analytics
**GET** `/api/analytics/sales`

**Description**: Retrieves detailed sales analytics including monthly revenue trends, store performance comparisons, market share analysis, and quarterly platform performance.

**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "revenueByMonth": [...],
    "revenueByStore": [...],
    "marketShare": [...],
    "quarterlyPerformance": [...]
  }
}
```

---

### 5. Get Product Analytics
**GET** `/api/analytics/product/:productId`

**Description**: Retrieves detailed analytics for a specific product including sales performance over time and revenue contribution to the store.

**Permissions**: Store owner only

**Response**:
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "product123",
      "name": "Product Name",
      "store": "Store Name",
      "category": "Category Name"
    },
    "salesData": [...],
    "metrics": {
      "totalUnitsSold": 150,
      "totalRevenue": 2500,
      "revenueContribution": "15.5%"
    }
  }
}
```

---

### 6. Update Analytics
**POST** `/api/analytics/update`

**Description**: Manually triggers an update of analytics data. This endpoint can also be called by cron jobs for automated updates.

**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "message": "Analytics updated successfully"
}
```

---

## Dashboard Endpoints (Existing)

### Admin Dashboard
**GET** `/api/dashbord/admin`

### Store Dashboard
**GET** `/api/dashbord/store`

---

## Usage Examples

### Fetch Overall Analytics (Admin)
```bash
curl -X GET /api/analytics/overall \
  -H "Authorization:  YOUR_ADMIN_TOKEN"
```

### Fetch Store Analytics (Store Owner)
```bash
curl -X GET /api/analytics/store \
  -H "Authorization:  YOUR_STORE_TOKEN"
```

### Fetch Advanced Store Analytics (Store Owner)
```bash
curl -X GET /api/analytics/store/advanced \
  -H "Authorization:  YOUR_STORE_TOKEN"
```

### Fetch Product Analytics (Store Owner)
```bash
curl -X GET /api/analytics/product/PRODUCT_ID \
  -H "Authorization:  YOUR_STORE_TOKEN"
```

### Update Analytics Data
```bash
curl -X POST /api/analytics/update \
  -H "Authorization:  YOUR_ADMIN_TOKEN"
```

## Analytics Data Descriptions

### Quarterly Reports
Provides revenue, order count, and average order value for each quarter.

### Market Share Analysis
Shows each store's revenue as a percentage of total platform revenue.

### Product Performance
Details each product's sales volume, revenue generated, and percentage contribution to store revenue.

### Revenue by Category
Breaks down store revenue by product category for better inventory decisions.

### Advanced Analytics Charts
Provides chart-ready data structures for:
- Revenue trends over time
- Product sales distribution (pie charts)
- Order volume by day of week
- Customer acquisition trends