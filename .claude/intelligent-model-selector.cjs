#!/usr/bin/env node

/**
 * Intelligent Model Selector for Hive Mind
 *
 * This script analyzes task complexity and recommends the appropriate
 * Claude model (Opus 4.5, Sonnet 4.5, or Haiku 3.5)
 */

const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'model-selection-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Calculate task complexity score (0-100)
 */
function calculateComplexityScore(taskDescription, metadata = {}) {
  let score = 0;
  const desc = taskDescription.toLowerCase();

  // Keyword analysis
  const complexKeywords = [
    'architecture', 'design', 'research', 'novel', 'distributed',
    'security', 'algorithm', 'optimization', 'refactor.*complex',
    'analyze.*pattern', 'deep.*analysis'
  ];

  const moderateKeywords = [
    'implement', 'feature', 'test', 'review', 'fix', 'bug',
    'document', 'api', 'service', 'integration'
  ];

  const simpleKeywords = [
    'format', 'validate', 'search', 'find', 'list', 'check',
    'rename', 'move', 'copy', 'simple'
  ];

  // Base score from keywords
  if (complexKeywords.some(kw => new RegExp(kw).test(desc))) {
    score += 40;
  } else if (moderateKeywords.some(kw => new RegExp(kw).test(desc))) {
    score += 20;
  } else if (simpleKeywords.some(kw => new RegExp(kw).test(desc))) {
    score += 5;
  } else {
    score += 15; // Unknown defaults to moderate-low
  }

  // Metadata-based scoring
  if (metadata.filesAffected) {
    const fileScore = Math.min(metadata.filesAffected * 2, 20);
    score += fileScore * 0.15;
  }

  if (metadata.linesOfCode) {
    const locScore = Math.min(metadata.linesOfCode / 50, 20);
    score += locScore * 0.2;
  }

  if (metadata.requiresDomainExpertise) {
    score += 25;
  }

  if (metadata.isNovel) {
    score += 20;
  }

  if (metadata.criticalityLevel) {
    const criticalityMap = { low: 0, medium: 10, high: 20, critical: 25 };
    score += criticalityMap[metadata.criticalityLevel] || 10;
  }

  return Math.min(Math.round(score), 100);
}

/**
 * Select appropriate model based on task complexity
 */
function selectModel(taskDescription, metadata = {}, agentType = null) {
  // Special case: coordinator always uses Opus
  if (agentType === 'coordinator' || agentType === 'planner' || agentType === 'queen') {
    return {
      model: 'opus',
      modelId: 'claude-opus-4-5-20251101',
      reasoning: 'Coordinator role requires maximum intelligence for strategic planning'
    };
  }

  const complexityScore = calculateComplexityScore(taskDescription, metadata);

  // Check agent type overrides
  const complexityConfig = config.workers.complexity_based_routing;

  if (agentType) {
    if (complexityConfig.use_opus.agent_types.includes(agentType)) {
      return {
        model: 'opus',
        modelId: 'claude-opus-4-5-20251101',
        reasoning: `Agent type '${agentType}' typically requires Opus for complex reasoning`,
        complexityScore
      };
    }

    if (complexityConfig.use_haiku.agent_types.includes(agentType)) {
      return {
        model: 'haiku',
        modelId: 'claude-3-5-haiku-20241022',
        reasoning: `Agent type '${agentType}' can use Haiku for efficiency`,
        complexityScore
      };
    }
  }

  // Pattern matching
  const desc = taskDescription.toLowerCase();

  for (const pattern of complexityConfig.use_opus.task_patterns) {
    if (new RegExp(pattern).test(desc)) {
      return {
        model: 'opus',
        modelId: 'claude-opus-4-5-20251101',
        reasoning: `Task matches complex pattern: ${pattern}`,
        complexityScore
      };
    }
  }

  for (const pattern of complexityConfig.use_haiku.task_patterns) {
    if (new RegExp(pattern).test(desc)) {
      return {
        model: 'haiku',
        modelId: 'claude-3-5-haiku-20241022',
        reasoning: `Task matches simple pattern: ${pattern}`,
        complexityScore
      };
    }
  }

  // Complexity score-based selection
  if (complexityScore >= 71) {
    return {
      model: 'opus',
      modelId: 'claude-opus-4-5-20251101',
      reasoning: `High complexity score: ${complexityScore}/100`,
      complexityScore
    };
  } else if (complexityScore <= 30) {
    return {
      model: 'haiku',
      modelId: 'claude-3-5-haiku-20241022',
      reasoning: `Low complexity score: ${complexityScore}/100`,
      complexityScore
    };
  } else {
    return {
      model: 'sonnet',
      modelId: 'claude-sonnet-4-5-20250929',
      reasoning: `Moderate complexity score: ${complexityScore}/100`,
      complexityScore
    };
  }
}

/**
 * CLI interface
 */
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Intelligent Model Selector for Hive Mind

Usage:
  node intelligent-model-selector.js <task> [options]

Options:
  --agent-type <type>         Agent type (researcher, coder, etc.)
  --files <count>             Number of files affected
  --lines <count>             Lines of code affected
  --domain-expertise          Requires domain expertise
  --novel                     Novel/innovative solution required
  --criticality <level>       Criticality (low, medium, high, critical)
  --json                      Output as JSON

Examples:
  node intelligent-model-selector.js "Design microservices architecture"
  node intelligent-model-selector.js "Implement login feature" --agent-type coder
  node intelligent-model-selector.js "Format TypeScript files" --files 50
  node intelligent-model-selector.js "Research AI patterns" --domain-expertise --novel

Output:
  Model recommendation with reasoning
`);
    process.exit(0);
  }

  const taskDescription = args[0];
  const metadata = {};

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--agent-type':
        metadata.agentType = args[++i];
        break;
      case '--files':
        metadata.filesAffected = parseInt(args[++i]);
        break;
      case '--lines':
        metadata.linesOfCode = parseInt(args[++i]);
        break;
      case '--domain-expertise':
        metadata.requiresDomainExpertise = true;
        break;
      case '--novel':
        metadata.isNovel = true;
        break;
      case '--criticality':
        metadata.criticalityLevel = args[++i];
        break;
      case '--json':
        metadata.outputJson = true;
        break;
    }
  }

  const agentType = metadata.agentType;
  delete metadata.agentType;
  delete metadata.outputJson;

  const recommendation = selectModel(taskDescription, metadata, agentType);

  if (args.includes('--json')) {
    console.log(JSON.stringify(recommendation, null, 2));
  } else {
    console.log('\n🤖 Intelligent Model Selection\n');
    console.log(`Task: ${taskDescription}`);
    console.log(`\n✅ Recommended Model: ${recommendation.model.toUpperCase()}`);
    console.log(`   Model ID: ${recommendation.modelId}`);
    console.log(`   Reasoning: ${recommendation.reasoning}`);
    if (recommendation.complexityScore !== undefined) {
      console.log(`   Complexity Score: ${recommendation.complexityScore}/100`);
    }
    console.log();
  }
}

module.exports = { selectModel, calculateComplexityScore };
