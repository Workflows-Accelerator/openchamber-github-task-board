import test from 'node:test';
import assert from 'node:assert/strict';

export function createDropdownState(selectElement) {
  let currentValue = selectElement.value;
  let isOpen = false;

  function getSelectedOption() {
    return selectElement.options.find((o) => o.value === currentValue) || selectElement.options[0] || null;
  }

  function getLabel() {
    const opt = getSelectedOption();
    return opt ? opt.text : currentValue;
  }

  function selectOption(val) {
    if (currentValue !== val) {
      currentValue = val;
      selectElement.value = val;
      if (typeof selectElement.dispatchEvent === 'function') {
        selectElement.dispatchEvent({ type: 'change', target: selectElement });
      }
    }
    isOpen = false;
  }

  return {
    get isOpen() { return isOpen; },
    toggle() { isOpen = !isOpen; },
    open() { isOpen = true; },
    close() { isOpen = false; },
    getLabel,
    selectOption,
    syncValue() {
      currentValue = selectElement.value;
    }
  };
}

test('createDropdownState initializes with correct selected label', () => {
  const mockSelect = {
    value: 'theme',
    options: [
      { value: 'theme', text: 'Theme' },
      { value: 'priority', text: 'Priority' },
      { value: 'none', text: 'None' },
    ],
    dispatchEvent() {}
  };

  const dropdown = createDropdownState(mockSelect);
  assert.equal(dropdown.getLabel(), 'Theme');
  assert.equal(dropdown.isOpen, false);

  dropdown.toggle();
  assert.equal(dropdown.isOpen, true);

  dropdown.selectOption('priority');
  assert.equal(mockSelect.value, 'priority');
  assert.equal(dropdown.getLabel(), 'Priority');
  assert.equal(dropdown.isOpen, false);
});

test('createDropdownState synchronizes when select value changes externally', () => {
  let changeFired = false;
  const mockSelect = {
    value: 'newest',
    options: [
      { value: 'newest', text: 'Newest' },
      { value: 'oldest', text: 'Oldest' },
    ],
    dispatchEvent(e) {
      if (e.type === 'change') changeFired = true;
    }
  };

  const dropdown = createDropdownState(mockSelect);
  assert.equal(dropdown.getLabel(), 'Newest');

  // External update (like reset button)
  mockSelect.value = 'oldest';
  dropdown.syncValue();
  assert.equal(dropdown.getLabel(), 'Oldest');

  // User click in dropdown
  dropdown.selectOption('newest');
  assert.equal(mockSelect.value, 'newest');
  assert.equal(changeFired, true);
});

export function createGroupCollapseManager(initialKeys = []) {
  const collapsed = new Set(initialKeys);
  return {
    isCollapsed(key) {
      return collapsed.has(key);
    },
    toggle(key) {
      if (collapsed.has(key)) {
        collapsed.delete(key);
        return false;
      } else {
        collapsed.add(key);
        return true;
      }
    },
    setCollapsed(key, shouldCollapse) {
      if (shouldCollapse) {
        collapsed.add(key);
      } else {
        collapsed.delete(key);
      }
    },
    toArray() {
      return Array.from(collapsed);
    }
  };
}

test('createGroupCollapseManager toggles and persists collapsed group keys', () => {
  const manager = createGroupCollapseManager(['kanban:todo:auth']);
  assert.equal(manager.isCollapsed('kanban:todo:auth'), true);
  assert.equal(manager.isCollapsed('kanban:todo:ui'), false);

  // Toggle existing: expands
  const isNowCollapsed1 = manager.toggle('kanban:todo:auth');
  assert.equal(isNowCollapsed1, false);
  assert.equal(manager.isCollapsed('kanban:todo:auth'), false);

  // Toggle new: collapses
  const isNowCollapsed2 = manager.toggle('list:frontend');
  assert.equal(isNowCollapsed2, true);
  assert.equal(manager.isCollapsed('list:frontend'), true);
  assert.deepEqual(manager.toArray(), ['list:frontend']);
});
