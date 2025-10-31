// Test file for analytics functionality
import mongoose from 'mongoose';
import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

// Import our analytics controller functions
import {
  getOverallAnalytics,
  getStoreAnalytics,
  getSalesAnalytics,
  getProductAnalytics,
  getAdvancedStoreAnalytics
} from '../src/modules/analytics/analytics.controler.js';

// Mock request and response objects
const mockRequest = (overrides = {}) => ({
  user: { id: 'user123', role: 'store' },
  params: {},
  query: {},
  body: {},
  ...overrides
});

const mockResponse = () => {
  const res = {};
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  return res;
};

describe('Analytics Controller', () => {
  describe('getOverallAnalytics', () => {
    it('should return overall analytics data', async () => {
      const req = mockRequest({ user: { role: 'admin' } });
      const res = mockResponse();
      
      // Mock the database calls
      sinon.stub(mongoose.Model, 'countDocuments').resolves(10);
      sinon.stub(mongoose.Model, 'aggregate').resolves([{ totalRevenue: 1000 }]);
      sinon.stub(mongoose.Model, 'find').resolves([]);
      
      await getOverallAnalytics(req, res);
      
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      
      // Restore stubs
      sinon.restore();
    });
  });

  describe('getStoreAnalytics', () => {
    it('should return store analytics data', async () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock the database calls
      sinon.stub(mongoose.Model, 'findOne').resolves({ _id: 'store123', name: 'Test Store' });
      sinon.stub(mongoose.Model, 'countDocuments').resolves(5);
      sinon.stub(mongoose.Model, 'aggregate').resolves([]);
      
      await getStoreAnalytics(req, res);
      
      expect(res.json.calledOnce).to.be.true;
      
      // Restore stubs
      sinon.restore();
    });
  });

  describe('getAdvancedStoreAnalytics', () => {
    it('should return advanced store analytics with chart data', async () => {
      const req = mockRequest();
      const res = mockResponse();
      
      // Mock the database calls
      sinon.stub(mongoose.Model, 'findOne').resolves({ _id: 'store123', name: 'Test Store' });
      sinon.stub(mongoose.Model, 'aggregate').resolves([]);
      
      await getAdvancedStoreAnalytics(req, res);
      
      expect(res.json.calledOnce).to.be.true;
      
      // Restore stubs
      sinon.restore();
    });
  });
});