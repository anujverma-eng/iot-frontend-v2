import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Clock, HardDrive, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { EstimateExportResponse } from '../api/telemetry.service';

interface ExportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onCancel?: () => void;
  estimation: EstimateExportResponse | null;
  isLoading: boolean;
  exportStatus: 'estimating' | 'confirming' | 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string | null;
  selectedSensors: string[];
  timeRange: {
    start: string;
    end: string;
  };
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
}

const ExportConfirmationModal: React.FC<ExportConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  estimation,
  isLoading,
  exportStatus,
  error,
  selectedSensors,
  timeRange,
  progress = 0,
  downloadedBytes = 0,
  totalBytes = 0
}) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatFileSize = (sizeKB: number) => {
    if (sizeKB < 1024) return `${sizeKB.toFixed(0)} KB`;
    if (sizeKB < 1024 * 1024) return `${(sizeKB / 1024).toFixed(1)} MB`;
    return `${(sizeKB / (1024 * 1024)).toFixed(1)} GB`;
  };

  const formatTimeRange = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString();
    const endDate = new Date(end).toLocaleDateString();
    return `${startDate} - ${endDate}`;
  };

  const getStatusContent = () => {
    switch (exportStatus) {
      case 'estimating':
        return (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold mb-2">Analyzing Dataset</h3>
            <p className="text-gray-600">
              Calculating the size and duration for your export request...
            </p>
          </div>
        );

      case 'confirming':
        if (!estimation?.data) return null;
        
        const data = estimation.data;
        return (
          <div>
            <div className="text-center mb-6">
              <Download className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-xl font-semibold mb-2">Confirm Data Export</h3>
              <p className="text-gray-600">
                Review the export details below and confirm to proceed
              </p>
            </div>

            {/* Export Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold mb-3">Export Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Sensors:</span>
                  <span className="ml-2 font-medium">{selectedSensors.length}</span>
                </div>
                <div>
                  <span className="text-gray-500">Time Range:</span>
                  <span className="ml-2 font-medium text-xs">
                    {formatTimeRange(timeRange.start, timeRange.end)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total Records:</span>
                  <span className="ml-2 font-medium">{data.totalRecords.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Est File Size:</span>
                  <span className="ml-2 font-medium">{formatFileSize(data.estimatedSizeKB)}</span>
                </div>
              </div>
            </div>

            {/* Performance Info */}
            <div className="flex items-start space-x-3 mb-6">
              <Clock className="w-5 h-5 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Estimated Duration: {data.estimatedDuration}</p>
                <p className="text-sm text-gray-600">{data.performanceNote}</p>
              </div>
            </div>

            {/* Recommendation */}
            {data.recommendation === 'background' && (
              <div className="flex items-start space-x-3 mb-6 p-3 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Large Dataset Warning</p>
                  <p className="text-sm text-yellow-700">
                    This is a large dataset that may take several minutes to download. 
                    Please keep this window open during the process.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        );

      case 'downloading':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
              <div 
                className="w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent absolute top-0 animate-spin"
              ></div>
              <HardDrive className="w-8 h-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Downloading Data</h3>
            <p className="text-gray-600 mb-4">
              Please wait while we prepare and download your data...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 flex items-center justify-center text-xs text-white font-medium" 
                style={{ width: `${Math.max(progress, 1)}%` }}
              >
                {progress > 10 && `${Math.round(progress)}%`}
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              <p className="font-medium">{Math.round(progress)}% complete</p>
              {totalBytes > 0 && (
                <p>
                  {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
                </p>
              )}
              {progress > 0 && progress < 100 && totalBytes > 0 && (
                <p className="text-xs">
                  Speed: ~{formatBytes(downloadedBytes > 0 ? (downloadedBytes / ((Date.now() - (Date.now() - 5000)) / 1000)) : 0)}/s
                </p>
              )}
            </div>
            <p className="text-sm text-yellow-600 mt-4 font-medium">
              ⚠️ Please do not close this window during download
            </p>
            {onCancel && (
              <button
                onClick={onCancel}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel Download
              </button>
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
            <h3 className="text-xl font-semibold mb-2 text-green-700">Download Complete!</h3>
            <p className="text-gray-600 mb-6">
              Your CSV file has been downloaded successfully.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Close
            </button>
          </div>
        );

      case 'cancelled':
        return (
          <div className="text-center py-8">
            <X className="w-16 h-16 mx-auto mb-4 text-orange-500" />
            <h3 className="text-xl font-semibold mb-2 text-orange-700">Download Cancelled</h3>
            <p className="text-gray-600 mb-6">
              The download has been cancelled by user request.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold mb-2 text-red-700">Export Failed</h3>
            <p className="text-gray-600 mb-2">
              {error || 'An unexpected error occurred during export.'}
            </p>
            {error?.includes('too large') && (
              <p className="text-sm text-orange-600 mb-6">
                💡 Try selecting a smaller date range or fewer sensors.
              </p>
            )}
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  // Prevent closing during download (but allow closing when cancelled)
  const canClose = exportStatus !== 'downloading';

  // Use portal to render at document body level to avoid z-index/clipping issues
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto dark:bg-content1">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-divider">
          <h2 className="text-lg font-semibold">CSV Data Export</h2>
          {canClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors dark:text-default-400 dark:hover:text-default-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {getStatusContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExportConfirmationModal;