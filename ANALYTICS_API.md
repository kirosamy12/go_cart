# Analytics API Documentation

## Overview
This API provides comprehensive analytics and reporting capabilities for the e-commerce platform, including overall platform metrics, store-specific analytics, and sales data.

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
    "ordersByDay": [...]
  }
}
```

---

### 2. Get Store Analytics
**GET** `/api/analytics/store`

**Description**: Retrieves analytics specific to the authenticated store owner, including store performance, top products, and sales trends.

**Permissions**: Store owner only

**Response**:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalOrders": 142,
      "totalRevenue": 8500,
      "totalProducts": 25
    },
    "topProducts": [...],
    "ordersByDay": [...],
    "revenueByCategory": [...]
  }
}
```

---

### 3. Get Sales Analytics
**GET** `/api/analytics/sales`

**Description**: Retrieves detailed sales analytics including monthly revenue trends and store performance comparisons.

**Permissions**: Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "revenueByMonth": [...],
    "revenueByStore": [...]
  }
}
```

---

### 4. Update Analytics
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

### Update Analytics Data
```bash
curl -X POST /api/analytics/update \
  -H "Authorization:  YOUR_ADMIN_TOKEN"
```