/**
 * Performance Test HTML Report Generator
 *
 * Parses k6 JSON output and generates comprehensive HTML reports with:
 * - Charts: throughput, latency, error rate over time
 * - Summary statistics
 * - Threshold pass/fail status
 * - Trend analysis
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Report configuration
const PERF_RESULTS_DIR = join(__dirname, '../../perf-results');
const REPORT_OUTPUT = join(PERF_RESULTS_DIR, 'performance-report.html');

/**
 * Load all k6 JSON results from perf-results directory
 */
function loadAllResults() {
  if (!existsSync(PERF_RESULTS_DIR)) {
    console.error(`Results directory not found: ${PERF_RESULTS_DIR}`);
    return {};
  }

  const results = {};
  const files = readdirSync(PERF_RESULTS_DIR).filter((f) => f.endsWith('.json'));

  console.log(`Found ${files.length} result files`);

  files.forEach((file) => {
    const filepath = join(PERF_RESULTS_DIR, file);
    try {
      const data = readFileSync(filepath, 'utf-8');
      const testName = file.replace('-summary.json', '');
      results[testName] = JSON.parse(data);
      console.log(`Loaded: ${testName}`);
    } catch (error) {
      console.error(`Error loading ${file}:`, error.message);
    }
  });

  return results;
}

/**
 * Format metric value based on type
 */
function formatMetric(value, type) {
  if (value === undefined || value === null) return 'N/A';

  if (type === 'rate') {
    return `${(value * 100).toFixed(2)}%`;
  } else if (type === 'trend') {
    return `${value.toFixed(2)}ms`;
  } else if (type === 'counter') {
    return value.toFixed(0);
  }
  return value.toFixed(2);
}

/**
 * Extract key metrics from k6 results
 */
function extractKeyMetrics(summary) {
  const metrics = {};

  // HTTP metrics
  if (summary.metrics.http_req_duration) {
    metrics.http_req_duration = summary.metrics.http_req_duration.values;
  }
  if (summary.metrics.http_req_failed) {
    metrics.http_req_failed = summary.metrics.http_req_failed.values;
  }
  if (summary.metrics.http_reqs) {
    metrics.http_reqs = summary.metrics.http_reqs.values;
  }

  // Custom metrics
  if (summary.metrics.errors) {
    metrics.errors = summary.metrics.errors.values;
  }

  return metrics;
}

/**
 * Check if thresholds passed
 */
function checkThresholds(summary) {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    details: [],
  };

  Object.entries(summary.metrics || {}).forEach(([metricName, metric]) => {
    if (metric.thresholds) {
      Object.entries(metric.thresholds).forEach(([threshold, passed]) => {
        results.total++;
        if (passed) {
          results.passed++;
        } else {
          results.failed++;
        }
        results.details.push({
          metric: metricName,
          threshold,
          passed,
        });
      });
    }
  });

  return results;
}

/**
 * Generate chart data for visualization
 */
function generateChartData(results) {
  const chartData = {
    labels: [],
    throughput: [],
    latencyP95: [],
    latencyP99: [],
    errorRate: [],
  };

  Object.entries(results).forEach(([testName, summary]) => {
    chartData.labels.push(testName.replace(/-/g, ' '));

    const metrics = extractKeyMetrics(summary);

    // Throughput (requests/second)
    if (metrics.http_reqs && metrics.http_reqs.rate) {
      chartData.throughput.push(metrics.http_reqs.rate.toFixed(2));
    } else {
      chartData.throughput.push(0);
    }

    // Latency
    if (metrics.http_req_duration) {
      chartData.latencyP95.push((metrics.http_req_duration['p(95)'] || 0).toFixed(2));
      chartData.latencyP99.push((metrics.http_req_duration['p(99)'] || 0).toFixed(2));
    } else {
      chartData.latencyP95.push(0);
      chartData.latencyP99.push(0);
    }

    // Error rate
    if (metrics.http_req_failed && metrics.http_req_failed.rate !== undefined) {
      chartData.errorRate.push((metrics.http_req_failed.rate * 100).toFixed(2));
    } else {
      chartData.errorRate.push(0);
    }
  });

  return chartData;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(results) {
  const timestamp = new Date().toISOString();
  const chartData = generateChartData(results);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report - Birthday Message Scheduler</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .summary-card h3 {
            color: #555;
            font-size: 0.9em;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .summary-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #333;
        }
        .summary-card.success .value {
            color: #28a745;
        }
        .summary-card.warning .value {
            color: #ffc107;
        }
        .summary-card.danger .value {
            color: #dc3545;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        .chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 30px;
            background: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
        }
        .test-results {
            display: grid;
            gap: 20px;
        }
        .test-card {
            background: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            border-left: 4px solid #667eea;
        }
        .test-card h3 {
            color: #333;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric-item {
            background: white;
            padding: 12px;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        .metric-item .label {
            color: #888;
            font-size: 0.85em;
            margin-bottom: 5px;
        }
        .metric-item .value {
            font-size: 1.4em;
            font-weight: bold;
            color: #333;
        }
        .threshold-list {
            margin-top: 15px;
        }
        .threshold-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            margin-bottom: 8px;
            background: white;
            border-radius: 6px;
            border-left: 3px solid #ccc;
        }
        .threshold-item.pass {
            border-left-color: #28a745;
        }
        .threshold-item.fail {
            border-left-color: #dc3545;
        }
        .threshold-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
        }
        .threshold-badge.pass {
            background: #d4edda;
            color: #155724;
        }
        .threshold-badge.fail {
            background: #f8d7da;
            color: #721c24;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #888;
            font-size: 0.9em;
        }
        .timestamp {
            color: #999;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Test Report</h1>
            <p>Birthday Message Scheduler - k6 Load Testing Results</p>
            <p class="timestamp">Generated: ${timestamp}</p>
        </div>

        <div class="content">
            ${generateOverviewSection(results)}
            ${generateChartsSection(chartData)}
            ${generateDetailedResultsSection(results)}
        </div>

        <div class="footer">
            <p>Performance testing powered by k6 | ${Object.keys(results).length} tests executed</p>
        </div>
    </div>

    <script>
        ${generateChartScripts(chartData)}
    </script>
</body>
</html>`;

  return html;
}

function generateOverviewSection(results) {
  let totalRequests = 0;
  let totalErrors = 0;
  let avgLatency = 0;
  let testCount = 0;
  let totalThresholdsPassed = 0;
  let totalThresholds = 0;

  Object.values(results).forEach((summary) => {
    const metrics = extractKeyMetrics(summary);
    if (metrics.http_reqs && metrics.http_reqs.count) {
      totalRequests += metrics.http_reqs.count;
    }
    if (metrics.errors && metrics.errors.count) {
      totalErrors += metrics.errors.count;
    }
    if (metrics.http_req_duration && metrics.http_req_duration.avg) {
      avgLatency += metrics.http_req_duration.avg;
      testCount++;
    }

    const thresholds = checkThresholds(summary);
    totalThresholdsPassed += thresholds.passed;
    totalThresholds += thresholds.total;
  });

  if (testCount > 0) {
    avgLatency /= testCount;
  }

  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  const thresholdPassRate =
    totalThresholds > 0 ? (totalThresholdsPassed / totalThresholds) * 100 : 0;

  return `
    <div class="section">
        <h2>Overview</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">${Object.keys(results).length}</div>
            </div>
            <div class="summary-card">
                <h3>Total Requests</h3>
                <div class="value">${totalRequests.toLocaleString()}</div>
            </div>
            <div class="summary-card ${avgLatency < 500 ? 'success' : avgLatency < 1000 ? 'warning' : 'danger'}">
                <h3>Avg Latency</h3>
                <div class="value">${avgLatency.toFixed(0)}ms</div>
            </div>
            <div class="summary-card ${errorRate < 1 ? 'success' : errorRate < 5 ? 'warning' : 'danger'}">
                <h3>Error Rate</h3>
                <div class="value">${errorRate.toFixed(2)}%</div>
            </div>
            <div class="summary-card ${thresholdPassRate >= 95 ? 'success' : thresholdPassRate >= 80 ? 'warning' : 'danger'}">
                <h3>Thresholds Passed</h3>
                <div class="value">${totalThresholdsPassed}/${totalThresholds}</div>
            </div>
        </div>
    </div>
    `;
}

function generateChartsSection(chartData) {
  return `
    <div class="section">
        <h2>Performance Charts</h2>
        <div class="chart-container">
            <canvas id="throughputChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="latencyChart"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="errorChart"></canvas>
        </div>
    </div>
    `;
}

function generateDetailedResultsSection(results) {
  let html = `
    <div class="section">
        <h2>Detailed Results</h2>
        <div class="test-results">
    `;

  Object.entries(results).forEach(([testName, summary]) => {
    const metrics = extractKeyMetrics(summary);
    const thresholds = checkThresholds(summary);

    html += `
        <div class="test-card">
            <h3>${testName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</h3>

            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="label">Total Requests</div>
                    <div class="value">${metrics.http_reqs?.count?.toLocaleString() || 'N/A'}</div>
                </div>
                <div class="metric-item">
                    <div class="label">Requests/sec</div>
                    <div class="value">${metrics.http_reqs?.rate?.toFixed(2) || 'N/A'}</div>
                </div>
                <div class="metric-item">
                    <div class="label">Avg Latency</div>
                    <div class="value">${metrics.http_req_duration?.avg?.toFixed(2) || 'N/A'}ms</div>
                </div>
                <div class="metric-item">
                    <div class="label">p95 Latency</div>
                    <div class="value">${metrics.http_req_duration?.['p(95)']?.toFixed(2) || 'N/A'}ms</div>
                </div>
                <div class="metric-item">
                    <div class="label">p99 Latency</div>
                    <div class="value">${metrics.http_req_duration?.['p(99)']?.toFixed(2) || 'N/A'}ms</div>
                </div>
                <div class="metric-item">
                    <div class="label">Error Rate</div>
                    <div class="value">${((metrics.http_req_failed?.rate || 0) * 100).toFixed(2)}%</div>
                </div>
            </div>

            <div class="threshold-list">
                <h4>Thresholds (${thresholds.passed}/${thresholds.total} passed)</h4>
                ${thresholds.details
                  .map(
                    (t) => `
                    <div class="threshold-item ${t.passed ? 'pass' : 'fail'}">
                        <span>${t.metric}: ${t.threshold}</span>
                        <span class="threshold-badge ${t.passed ? 'pass' : 'fail'}">${t.passed ? 'PASS' : 'FAIL'}</span>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
        `;
  });

  html += `
        </div>
    </div>
    `;

  return html;
}

function generateChartScripts(chartData) {
  return `
        // Throughput Chart
        new Chart(document.getElementById('throughputChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(chartData.labels)},
                datasets: [{
                    label: 'Throughput (req/s)',
                    data: ${JSON.stringify(chartData.throughput)},
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Throughput Comparison'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Requests/Second'
                        }
                    }
                }
            }
        });

        // Latency Chart
        new Chart(document.getElementById('latencyChart'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify(chartData.labels)},
                datasets: [
                    {
                        label: 'p95 Latency',
                        data: ${JSON.stringify(chartData.latencyP95)},
                        borderColor: 'rgba(255, 193, 7, 1)',
                        backgroundColor: 'rgba(255, 193, 7, 0.2)',
                        tension: 0.4
                    },
                    {
                        label: 'p99 Latency',
                        data: ${JSON.stringify(chartData.latencyP99)},
                        borderColor: 'rgba(220, 53, 69, 1)',
                        backgroundColor: 'rgba(220, 53, 69, 0.2)',
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Latency Comparison (p95 vs p99)'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Latency (ms)'
                        }
                    }
                }
            }
        });

        // Error Rate Chart
        new Chart(document.getElementById('errorChart'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify(chartData.labels)},
                datasets: [{
                    label: 'Error Rate (%)',
                    data: ${JSON.stringify(chartData.errorRate)},
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Error Rate Comparison'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Error Rate (%)'
                        }
                    }
                }
            }
        });
    `;
}

// Main execution
console.log('Performance Report Generator');
console.log('============================\n');

// Ensure output directory exists
if (!existsSync(PERF_RESULTS_DIR)) {
  mkdirSync(PERF_RESULTS_DIR, { recursive: true });
  console.log(`Created directory: ${PERF_RESULTS_DIR}`);
}

// Load all results
const results = loadAllResults();

if (Object.keys(results).length === 0) {
  console.error('No test results found. Run performance tests first.');
  process.exit(1);
}

// Generate HTML report
console.log('\nGenerating HTML report...');
const html = generateHtmlReport(results);

// Write report
writeFileSync(REPORT_OUTPUT, html, 'utf-8');
console.log(`\nReport generated: ${REPORT_OUTPUT}`);
console.log(`Open in browser: file://${REPORT_OUTPUT}`);

console.log('\nReport generation complete!');
