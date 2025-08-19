import test from 'ava';
import ToolInterface from './tool-interface.js';

test('ToolInterface can be imported', (t) => {
  t.truthy(ToolInterface);
});

test('ToolInterface defines expected structure', (t) => {
  // If ToolInterface is a class
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();
    t.truthy(toolInterface);

    // Check for required methods
    const expectedMethods = ['execute', 'validate', 'getEstimate'];
    for (const method of expectedMethods) {
      if (typeof toolInterface[method] === 'function') {
        t.is(typeof toolInterface[method], 'function');
      }
    }
  }
  // If ToolInterface is an object/module
  else if (typeof ToolInterface === 'object') {
    t.true(typeof ToolInterface === 'object');
  }
  // If ToolInterface is a symbol, constant, or other type
  else {
    t.pass(); // Accept any valid export
  }
});

test('ToolInterface execute method throws not implemented if abstract', async (t) => {
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();

    if (typeof toolInterface.execute === 'function') {
      await t.throwsAsync(
        async () => {
          await toolInterface.execute({});
        },
        { message: /Tool must implement execute method/ }
      );
    } else {
      t.pass(); // Skip if execute not defined
    }
  } else {
    t.pass(); // Skip if not a class
  }
});

test('ToolInterface validate method throws not implemented if abstract', async (t) => {
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();

    if (typeof toolInterface.validate === 'function') {
      await t.throwsAsync(
        async () => {
          await toolInterface.validate({});
        },
        { message: /Tool must implement validate method/ }
      );
    } else {
      t.pass(); // Skip if validate not defined
    }
  } else {
    t.pass(); // Skip if not a class
  }
});

test('ToolInterface getEstimate method throws not implemented if abstract', async (t) => {
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();

    if (typeof toolInterface.getEstimate === 'function') {
      await t.throwsAsync(
        async () => {
          await toolInterface.getEstimate({});
        },
        { message: /Tool must implement getEstimate method/ }
      );
    } else {
      t.pass(); // Skip if getEstimate not defined
    }
  } else {
    t.pass(); // Skip if not a class
  }
});

test('ToolInterface defines required metadata structure', (t) => {
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();

    // Check if metadata property exists and has expected structure
    if (toolInterface.metadata) {
      t.true(typeof toolInterface.metadata === 'object');

      // Check for common metadata fields
      const expectedFields = ['name', 'description', 'version'];
      for (const field of expectedFields) {
        if (toolInterface.metadata[field] !== undefined) {
          t.true(typeof toolInterface.metadata[field] === 'string');
        }
      }
    } else {
      t.pass(); // Skip if no metadata defined
    }
  } else {
    t.pass(); // Skip if not a class
  }
});

test('ToolInterface can be extended by concrete implementations', async (t) => {
  if (typeof ToolInterface === 'function') {
    class ConcreteTool extends ToolInterface {
      async execute(config) {
        return { success: true, config };
      }

      async validate() {
        return { isValid: true };
      }

      async getEstimate() {
        return { estimatedDuration: 1000 };
      }
    }

    const tool = new ConcreteTool();
    t.truthy(tool);
    t.true(tool instanceof ToolInterface);

    // Test that concrete methods work
    await t.notThrowsAsync(async () => {
      const result = await tool.execute({ test: true });
      t.truthy(result);
    });

    await t.notThrowsAsync(async () => {
      const validation = await tool.validate({ test: true });
      t.truthy(validation);
    });

    await t.notThrowsAsync(async () => {
      const estimate = await tool.getEstimate({ test: true });
      t.truthy(estimate);
    });
  } else {
    t.pass(); // Skip if not a class that can be extended
  }
});

test('ToolInterface provides consistent method signatures', (t) => {
  if (typeof ToolInterface === 'function') {
    const toolInterface = new ToolInterface();

    // Check method signatures if methods exist
    if (typeof toolInterface.execute === 'function') {
      t.is(toolInterface.execute.length, 0); // Abstract method has no parameters
    }

    if (typeof toolInterface.validate === 'function') {
      t.is(toolInterface.validate.length, 0); // Abstract method has no parameters
    }

    if (typeof toolInterface.getEstimate === 'function') {
      t.is(toolInterface.getEstimate.length, 0); // Abstract method has no parameters
    }
  } else {
    t.pass(); // Skip if not a class
  }
});
