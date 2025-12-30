import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Performance test report generator
 * Aggregates k6 results and generates HTML report
 */

interface K6Metric {
  type: string;
  contains: string;
  values?: Record<string, number>;
  thresholds?: Record<string, boolean>;
}

interface K6Summary {
  metrics: Record<string, K6Metric>;
  root_group?: {
    checks: any[];
    groups: any[];
  };
}

function loadK6Results(filename: string): K6Summary | null {
  const filepath = join(process.cwd(), 'perf-results', filename);

  if (!existsSync(filepath)) {
    console.warn(`File not found: ${filepath}`);
    return null;
  }

  try {
    const data = readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

function formatMetric(value: number, type: string): string {
  if (type === 'rate') {
    return `${(value * 100).toFixed(2)}%`;
  } else if (type === 'trend') {
    return `${value.toFixed(2)}ms`;
  } else if (type === 'counter') {
    return value.toFixed(0);
  }
  return value.toString();
}

function generateHtmlReport(reports: Record<string, K6Summary | null>): string {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 30px; }
        .summary {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .metric:hover {
            background-color: #f9f9f9;
        }
        .metric-header {
            font-weight: bold;
            background-color: #f0f0f0;
        }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .timestamp {
            color: #888;
            font-size: 0.9em;
        }
        .threshold {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85em;
        }
        .threshold.pass {
            background-color: #d4edda;
            color: #155724;
        }
        .threshold.fail {
            background-color: #f8d7da;
            color: #721c24;
        }
    </style>
</head>
<body>
    <h1>Performance Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toISOString()}</p>

    ${Object.entries(reports)
      .map(
        ([name, data]) => `
    <div class="summary">
        <h2>${name}</h2>
        ${
          data
            ? `
        <div class="metric metric-header">
            <span>Metric</span>
            <span>Average</span>
            <span>P95</span>
            <span>P99</span>
        </div>
        ${Object.entries(data.metrics)
          .filter(([_, metric]) => metric.type === 'trend')
          .map(
            ([metricName, metric]) => `
        <div class="metric">
            <span>${metricName}</span>
            <span>${metric.values?.avg ? formatMetric(metric.values.avg, 'trend') : 'N/A'}</span>
            <span>${metric.values?.['p(95)'] ? formatMetric(metric.values['p(95)'], 'trend') : 'N/A'}</span>
            <span>${metric.values?.['p(99)'] ? formatMetric(metric.values['p(99)'], 'trend') : 'N/A'}</span>
        </div>
        `
          )
          .join('')}

        <h3>Thresholds</h3>
        ${Object.entries(data.metrics)
          .filter(([_, metric]) => metric.thresholds)
          .map(
            ([metricName, metric]) => `
        <div>
            <strong>${metricName}:</strong>
            ${Object.entries(metric.thresholds || {})
              .map(
                ([threshold, passed]) =>
                  `<span class="threshold ${passed ? 'pass' : 'fail'}">${threshold}: ${passed ? 'PASS' : 'FAIL'}</span>`
              )
              .join(' ')}
        </div>
        `
          )
          .join('')}
        `
            : '<p>No data available</p>'
        }
    </div>
    `
      )
      .join('')}
</body>
</html>
`;

  return html;
}

function main() {
  console.log('Generating performance test report...');

  // Ensure perf-results directory exists
  const perfResultsDir = join(process.cwd(), 'perf-results');
  if (!existsSync(perfResultsDir)) {
    mkdirSync(perfResultsDir, { recursive: true });
  }

  // Load all k6 results
  const reports = {
    'Sustained Load (1M/day)': loadK6Results('sustained-load-summary.json'),
    'Peak Load (100+ msg/sec)': loadK6Results('peak-load-summary.json'),
    'Worker Scaling': loadK6Results('worker-scaling-summary.json'),
  };

  // Generate HTML report
  const html = generateHtmlReport(reports);
  const reportPath = join(perfResultsDir, 'performance-report.html');
  writeFileSync(reportPath, html);

  console.log(`Report generated: ${reportPath}`);

  // Generate summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    tests: Object.entries(reports).map(([name, data]) => ({
      name,
      success: data !== null,
      metrics: data?.metrics || {},
    })),
  };

  const summaryPath = join(perfResultsDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`Summary generated: ${summaryPath}`);
  console.log('\nPerformance test report generation complete!');
}

main();
