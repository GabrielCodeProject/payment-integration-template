import Sequencer from '@jest/test-sequencer';

/**
 * Custom test sequencer to optimize database test execution order
 * Runs lighter/faster tests first, then heavier performance tests
 */
class DatabaseTestSequencer extends Sequencer {
  sort(tests) {
    // Define test priority order (lower number = higher priority/earlier execution)
    const testPriorities = {
      'database/unit': 1,          // Unit tests first
      'database/integration': 2,    // Integration tests second
      'database/migration': 3,      // Migration tests third
      'security': 4,                // Security tests fourth
      'performance': 5,             // Performance tests last
      'benchmarks': 6               // Benchmarks last
    };
    
    // Sort tests based on their path and priority
    const sortedTests = tests.sort((testA, testB) => {
      const priorityA = this.getTestPriority(testA.path, testPriorities);
      const priorityB = this.getTestPriority(testB.path, testPriorities);
      
      // Primary sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // Secondary sort by file name for consistency
      return testA.path.localeCompare(testB.path);
    });
    
    console.log(`🔄 Test execution order optimized for ${sortedTests.length} tests`);
    return sortedTests;
  }
  
  getTestPriority(testPath, priorities) {
    // Find the highest priority match for the test path
    for (const [pathSegment, priority] of Object.entries(priorities)) {
      if (testPath.includes(pathSegment)) {
        return priority;
      }
    }
    
    // Default priority for unmatched tests
    return 99;
  }
}

export default DatabaseTestSequencer;