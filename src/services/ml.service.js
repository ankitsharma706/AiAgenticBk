const mlClient = require('../utils/apiClient');

class MlService {
  async predictUser(userData) {
    try {
      const response = await mlClient.post('/predict', userData);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async trainModel(trainConfig) {
    try {
      const response = await mlClient.post('/train', trainConfig);
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }
  
  async analyzeReport(type) {
    try {
      const response = await mlClient.post('/report/analyze', { type });
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async generateReport() {
    try {
      const response = await mlClient.post('/report/generate');
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getDashboard() {
    try {
      const response = await mlClient.get('/report/dashboard');
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getLatestPdf() {
    try {
      const response = await mlClient.get('/report/pdf/latest', {
        responseType: 'arraybuffer'
      });
      return response;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getLatestCsv() {
    try {
      const response = await mlClient.get('/report/csv/latest', {
        responseType: 'arraybuffer'
      });
      return response;
    } catch (error) {
      this._handleError(error);
    }
  }

  _handleError(error) {
    const status = error.response ? error.response.status : 500;
    const message = error.response ? error.response.data.detail : 'ML Service Unavailable';
    
    // Log detailed error for debugging
    console.error(`[MlService] Error: ${message}`, {
      status,
      code: error.code,
      url: error.config ? error.config.url : 'unknown',
      method: error.config ? error.config.method : 'unknown'
    });

    const err = new Error(message);
    err.status = status;
    throw err;
  }
}

module.exports = new MlService();
