#!/usr/bin/env python3
"""
Dashboard Enhancement Script
Adds variables, drill-down links, annotations, and improved descriptions to all Grafana dashboards
"""

import json
import sys
from pathlib import Path

# Dashboard enhancement configurations
DASHBOARD_CONFIGS = {
    "message-processing.json": {
        "specific_variables": [
            {
                "name": "queue",
                "type": "query",
                "query": "label_values(birthday_scheduler_queue_depth{namespace=\"$namespace\", instance=~\"$instance\"}, queue_name)",
                "label": "Queue",
                "description": "Filter by queue name",
                "includeAll": True,
                "multi": True
            }
        ],
        "drill_down_links": [
            {
                "title": "Database Dashboard",
                "url": "/d/database?var-namespace=$namespace&var-instance=$instance&from=$__from&to=$__to",
                "tooltip": "View database metrics for queue persistence"
            },
            {
                "title": "Overview Dashboard",
                "url": "/d/overview?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "Return to overview dashboard"
            }
        ],
        "alert_filter": "QueueDepthCritical|DLQMessagesPresent|HighMessageRetryRate|MessageProcessingSlow|MessageDeliveryRate|MessageSuccessRate"
    },
    "database.json": {
        "specific_variables": [
            {
                "name": "table",
                "type": "query",
                "query": "label_values(birthday_scheduler_database_query_duration_seconds_bucket{namespace=\"$namespace\", instance=~\"$instance\"}, table)",
                "label": "Table",
                "description": "Filter by table name",
                "includeAll": True,
                "multi": True
            }
        ],
        "drill_down_links": [
            {
                "title": "Infrastructure Dashboard",
                "url": "/d/infrastructure?var-namespace=$namespace&var-instance=$instance&from=$__from&to=$__to",
                "tooltip": "View system resource impact on database"
            },
            {
                "title": "Overview Dashboard",
                "url": "/d/overview?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "Return to overview dashboard"
            }
        ],
        "alert_filter": "DBConnectionPoolExhausted|DatabaseDown|DBConnectionPoolHigh|SlowQueries|DatabaseQueryLatency"
    },
    "infrastructure.json": {
        "specific_variables": [
            {
                "name": "node",
                "type": "query",
                "query": "label_values(birthday_scheduler_process_cpu_seconds_total{namespace=\"$namespace\"}, instance)",
                "label": "Node",
                "description": "Filter by node/server",
                "includeAll": True,
                "multi": True
            }
        ],
        "drill_down_links": [
            {
                "title": "Overview Dashboard",
                "url": "/d/overview?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "Return to overview dashboard"
            }
        ],
        "alert_filter": "ServiceDown|MemoryExhausted|CPUUsageHigh|MemoryUsageHigh|EventLoopLagHigh|HighGCPauseTime"
    },
    "overview-dashboard.json": {
        "specific_variables": [],
        "drill_down_links": [
            {
                "title": "API Performance",
                "url": "/d/api-performance?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View detailed API metrics"
            },
            {
                "title": "Message Processing",
                "url": "/d/message-processing?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View message queue metrics"
            },
            {
                "title": "Database",
                "url": "/d/database?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View database performance"
            },
            {
                "title": "Infrastructure",
                "url": "/d/infrastructure?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View infrastructure health"
            },
            {
                "title": "Security",
                "url": "/d/security?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View security metrics"
            }
        ],
        "alert_filter": ".*"
    },
    "security.json": {
        "specific_variables": [],
        "drill_down_links": [
            {
                "title": "Overview Dashboard",
                "url": "/d/overview?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "Return to overview dashboard"
            },
            {
                "title": "API Performance",
                "url": "/d/api-performance?var-namespace=$namespace&from=$__from&to=$__to",
                "tooltip": "View API security details"
            }
        ],
        "alert_filter": "SecurityBreach|UnauthorizedAccess|HighFailedLogins|RateLimitExceeded"
    }
}

def get_common_variables():
    """Return common variables for all dashboards"""
    return [
        {
            "name": "datasource",
            "type": "datasource",
            "query": "prometheus",
            "current": {"text": "Prometheus", "value": "Prometheus"},
            "hide": 0,
            "includeAll": False,
            "multi": False,
            "options": [],
            "refresh": 1,
            "regex": "",
            "skipUrlSync": False
        },
        {
            "name": "namespace",
            "type": "query",
            "datasource": "${datasource}",
            "query": "label_values(birthday_scheduler_api_requests_total, namespace)",
            "current": {"text": "production", "value": "production"},
            "hide": 0,
            "includeAll": False,
            "multi": False,
            "options": [],
            "refresh": 1,
            "regex": "",
            "skipUrlSync": False,
            "sort": 1,
            "label": "Namespace",
            "description": "Kubernetes namespace filter"
        },
        {
            "name": "instance",
            "type": "query",
            "datasource": "${datasource}",
            "query": "label_values(birthday_scheduler_api_requests_total{namespace=\"$namespace\"}, instance)",
            "current": {"text": "All", "value": "$__all"},
            "hide": 0,
            "includeAll": True,
            "multi": True,
            "options": [],
            "refresh": 1,
            "regex": "",
            "skipUrlSync": False,
            "sort": 1,
            "label": "Instance",
            "description": "Filter by instance/pod"
        },
        {
            "name": "interval",
            "type": "interval",
            "query": "1m,5m,10m,30m,1h",
            "current": {"text": "5m", "value": "5m"},
            "hide": 0,
            "includeAll": False,
            "multi": False,
            "options": [
                {"text": "1m", "value": "1m", "selected": False},
                {"text": "5m", "value": "5m", "selected": True},
                {"text": "10m", "value": "10m", "selected": False},
                {"text": "30m", "value": "30m", "selected": False},
                {"text": "1h", "value": "1h", "selected": False}
            ],
            "label": "Interval",
            "description": "Time aggregation interval"
        }
    ]

def create_annotations(alert_filter):
    """Create alert annotations for dashboard"""
    return {
        "list": [
            {
                "datasource": "${datasource}",
                "enable": True,
                "expr": f"ALERTS{{alertname=~\"{alert_filter}\", namespace=\"$namespace\"}}",
                "iconColor": "rgba(255, 96, 96, 1)",
                "name": "Alerts",
                "step": "60s",
                "tagKeys": "alertname,severity",
                "textFormat": "{{alertname}}: {{severity}}",
                "titleFormat": "Alert"
            }
        ]
    }

def create_links(drill_down_config):
    """Create dashboard links"""
    links = []
    for link in drill_down_config:
        links.append({
            "title": link["title"],
            "url": link["url"],
            "icon": "dashboard",
            "tooltip": link["tooltip"],
            "type": "link",
            "targetBlank": False
        })
    return links

def enhance_dashboard(dashboard_path, config):
    """Enhance a single dashboard with variables, links, and annotations"""
    print(f"Enhancing {dashboard_path.name}...")

    with open(dashboard_path, 'r') as f:
        data = json.load(f)

    dashboard = data.get("dashboard", {})

    # Add templating variables
    variables = get_common_variables()
    variables.extend(config.get("specific_variables", []))

    dashboard["templating"] = {"list": variables}

    # Add dashboard links
    dashboard["links"] = create_links(config["drill_down_links"])

    # Add annotations
    dashboard["annotations"] = create_annotations(config["alert_filter"])

    # Update panels with variable filters
    update_panel_queries(dashboard.get("panels", []), dashboard_path.name)

    # Write back enhanced dashboard
    data["dashboard"] = dashboard

    with open(dashboard_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"✓ Enhanced {dashboard_path.name}")

def update_panel_queries(panels, dashboard_name):
    """Update panel queries to use variables"""
    for panel in panels:
        # Update targets
        if "targets" in panel:
            for target in panel["targets"]:
                if "expr" in target:
                    expr = target["expr"]

                    # Add namespace filter if not present
                    if "namespace=" not in expr and "birthday_scheduler_" in expr:
                        expr = expr.replace("birthday_scheduler_", "birthday_scheduler_", 1)
                        expr = expr.replace("{", "{namespace=\"$namespace\", instance=~\"$instance\", ", 1)
                        if "{" not in expr:
                            # No existing filters
                            metric_parts = expr.split("[")
                            if len(metric_parts) > 0:
                                metric_name = metric_parts[0].split("(")[-1].strip()
                                expr = expr.replace(metric_name, f"{metric_name}{{namespace=\"$namespace\", instance=~\"$instance\"}}")

                    # Replace [5m] with [$interval] for flexibility
                    expr = expr.replace("[5m]", "[$interval]")

                    target["expr"] = expr

                    # Add refId if missing
                    if "refId" not in target:
                        target["refId"] = "A"

        # Add description if missing
        if "description" not in panel or not panel["description"]:
            panel["description"] = f"Panel {panel.get('id', '')}: {panel.get('title', 'No title')}"

def main():
    dashboards_dir = Path("/Users/hafizputraludyanto/git/github.com/fairyhunter13/happy-bday-app/grafana/dashboards")

    if not dashboards_dir.exists():
        print(f"Error: Directory {dashboards_dir} not found")
        sys.exit(1)

    print("Starting dashboard enhancement process...")
    print("=" * 60)

    for dashboard_file, config in DASHBOARD_CONFIGS.items():
        dashboard_path = dashboards_dir / dashboard_file

        if not dashboard_path.exists():
            print(f"Warning: {dashboard_file} not found, skipping...")
            continue

        try:
            enhance_dashboard(dashboard_path, config)
        except Exception as e:
            print(f"✗ Error enhancing {dashboard_file}: {e}")
            continue

    print("=" * 60)
    print("Dashboard enhancement completed!")
    print("\nEnhancements applied:")
    print("  - Common variables (namespace, instance, interval)")
    print("  - Dashboard-specific variables (path, queue, table, node)")
    print("  - Drill-down links between dashboards")
    print("  - Alert annotations")
    print("  - Panel descriptions")
    print("  - Variable-based query filters")

if __name__ == "__main__":
    main()
