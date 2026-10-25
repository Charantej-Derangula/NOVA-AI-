import test from 'node:test'
import assert from 'node:assert/strict'
import {
  safeFileSlug,
  escapeHtml,
  getStackMeta,
  detectLanguageFromBrief,
  resolveTargetLanguage,
  resolveFilenameForLanguage,
  validateCodeMatchesLanguage,
  synthesizeFallbackDevStarter,
  extractJsonFromResponse,
  buildOutlineMarkdown,
  buildInteractiveDeckHtml,
  type PresentationOutlineResult,
} from '../src/services/aiStudioService.ts'

test('AI Studio Service Unit Tests', async (t) => {
  await t.test('safeFileSlug sanitizes user input safely', () => {
    assert.equal(safeFileSlug('  Launching NOVA Workspace!  '), 'launching-nova-workspace')
    assert.equal(safeFileSlug('Special @#$% Characters!'), 'special-characters')
    assert.equal(safeFileSlug(''), 'nova-output')
    assert.equal(safeFileSlug('    '), 'nova-output')
  })

  await t.test('escapeHtml handles XML/HTML entities properly', () => {
    assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    assert.equal(escapeHtml("Tom & Jerry's"), 'Tom &amp; Jerry&#39;s')
  })

  await t.test('getStackMeta returns appropriate extensions and labels', () => {
    assert.equal(getStackMeta('React + TypeScript').extension, 'tsx')
    assert.equal(getStackMeta('Python').extension, 'py')
    assert.equal(getStackMeta('Node.js').extension, 'ts')
    assert.equal(getStackMeta('SQL').extension, 'sql')
    assert.equal(getStackMeta('Java').extension, 'java')
    assert.equal(getStackMeta('C').extension, 'c')
    assert.equal(getStackMeta('C++').extension, 'cpp')
    assert.equal(getStackMeta('C#').extension, 'cs')
    assert.equal(getStackMeta('JavaScript').extension, 'js')
    assert.equal(getStackMeta('TypeScript').extension, 'ts')
    assert.equal(getStackMeta('Go').extension, 'go')
    assert.equal(getStackMeta('Rust').extension, 'rs')
    assert.equal(getStackMeta('HTML/CSS').extension, 'html')
  })

  await t.test('detectLanguageFromBrief detects explicitly requested languages accurately', () => {
    // Exact user prompt
    assert.equal(detectLanguageFromBrief('Need a simple Java code of adding 2 numbers'), 'Java')

    // Mandatory regression cases
    assert.equal(detectLanguageFromBrief('Write a Java program to add two numbers.'), 'Java')
    assert.equal(detectLanguageFromBrief('Write a Python program to reverse a string.'), 'Python')
    assert.equal(detectLanguageFromBrief('Write a C program to check whether a number is prime.'), 'C')
    assert.equal(detectLanguageFromBrief('Write a C++ program to sort an array.'), 'C++')
    assert.equal(detectLanguageFromBrief('Write a JavaScript function to debounce a callback.'), 'JavaScript')
    assert.equal(detectLanguageFromBrief('Write an SQL query to find duplicate records.'), 'SQL')
    assert.equal(detectLanguageFromBrief('Create a React component using TypeScript.'), 'React + TypeScript')

    // Additional languages and edge cases
    assert.equal(detectLanguageFromBrief('Write a C# console app for Fibonacci'), 'C#')
    assert.equal(detectLanguageFromBrief('Build a Go concurrent worker pool'), 'Go')
    assert.equal(detectLanguageFromBrief('Write a Rust memory-safe parser'), 'Rust')
    assert.equal(detectLanguageFromBrief('Design HTML/CSS responsive pricing table'), 'HTML/CSS')
    assert.equal(detectLanguageFromBrief('Build a Node.js express webhook handler'), 'Node.js')
    assert.equal(detectLanguageFromBrief('Implement a TypeScript generic cache store'), 'TypeScript')

    // Ambiguous or non-language brief returns null
    assert.equal(detectLanguageFromBrief('Build an accessible modal dialog'), null)
  })

  await t.test('resolveTargetLanguage prioritizes explicit brief over default stack', () => {
    // When stack was left on React + TypeScript, but user asked for Java
    assert.equal(
      resolveTargetLanguage('Need a simple Java code of adding 2 numbers', 'React + TypeScript'),
      'Java'
    )
    assert.equal(
      resolveTargetLanguage('Write a Python program to reverse a string.', 'React + TypeScript'),
      'Python'
    )
    assert.equal(
      resolveTargetLanguage('Write a C program to check whether a number is prime.', 'React + TypeScript'),
      'C'
    )
    assert.equal(
      resolveTargetLanguage('Write a C++ program to sort an array.', 'React + TypeScript'),
      'C++'
    )
    assert.equal(
      resolveTargetLanguage('Write an SQL query to find duplicate records.', 'React + TypeScript'),
      'SQL'
    )

    // When stack is explicitly selected and brief is neutral
    assert.equal(resolveTargetLanguage('Build a debounce utility', 'JavaScript'), 'JavaScript')
    assert.equal(resolveTargetLanguage('Build an accessible modal', 'React + TypeScript'), 'React + TypeScript')
    assert.equal(resolveTargetLanguage('Find duplicate users', 'SQL'), 'SQL')
  })

  await t.test('resolveFilenameForLanguage adheres to language conventions and class names', () => {
    const javaMeta = getStackMeta('Java')
    const javaCode = `import java.util.Scanner;\n\npublic class AddTwoNumbers {\n    public static void main(String[] args) {\n    }\n}`
    assert.equal(
      resolveFilenameForLanguage('Component.tsx', javaCode, javaMeta, 'Need a simple Java code of adding 2 numbers'),
      'AddTwoNumbers.java'
    )

    const cMeta = getStackMeta('C')
    assert.equal(
      resolveFilenameForLanguage('Component.tsx', '#include <stdio.h>\nint main(void) {}', cMeta, 'Write a C program to check whether a number is prime.'),
      'check_prime.c'
    )

    const cppMeta = getStackMeta('C++')
    assert.equal(
      resolveFilenameForLanguage('Component.tsx', '#include <iostream>\nint main() {}', cppMeta, 'Write a C++ program to sort an array.'),
      'sort_array.cpp'
    )

    const pyMeta = getStackMeta('Python')
    assert.equal(
      resolveFilenameForLanguage('Component.tsx', 'def reverse_string(): pass', pyMeta, 'Write a Python program to reverse a string.'),
      'reverse_string.py'
    )

    const sqlMeta = getStackMeta('SQL')
    assert.equal(
      resolveFilenameForLanguage('Component.tsx', 'SELECT * FROM users;', sqlMeta, 'Write an SQL query to find duplicate records.'),
      'find_duplicates.sql'
    )
  })

  await t.test('validateCodeMatchesLanguage catches cross-language contaminations', () => {
    // Java validation
    assert.equal(
      validateCodeMatchesLanguage('import React from "react"; export default function App() {}', 'Java').valid,
      false
    )
    assert.equal(
      validateCodeMatchesLanguage('public class AddTwoNumbers {\n  public static void main(String[] args) {}\n}', 'Java').valid,
      true
    )

    // SQL validation
    assert.equal(
      validateCodeMatchesLanguage('import React from "react";', 'SQL').valid,
      false
    )
    assert.equal(
      validateCodeMatchesLanguage('SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;', 'SQL').valid,
      true
    )

    // C validation
    assert.equal(
      validateCodeMatchesLanguage('public class Main {}', 'C').valid,
      false
    )
    assert.equal(
      validateCodeMatchesLanguage('#include <stdio.h>\nint main(void) { return 0; }', 'C').valid,
      true
    )
  })

  await t.test('synthesizeFallbackDevStarter generates compilable standalone solutions for all mandatory cases', () => {
    // 1. Java Add Two Numbers
    const javaResult = synthesizeFallbackDevStarter('Need a simple Java code of adding 2 numbers', 'Java')
    assert.equal(javaResult.language, 'Java')
    assert.equal(javaResult.filename, 'AddTwoNumbers.java')
    assert.ok(javaResult.code.includes('public class AddTwoNumbers'))
    assert.ok(javaResult.code.includes('public static void main'))
    assert.ok(javaResult.code.includes('add(int a, int b)'))

    // 2. Python Reverse String
    const pyResult = synthesizeFallbackDevStarter('Write a Python program to reverse a string.', 'Python')
    assert.equal(pyResult.language, 'Python')
    assert.equal(pyResult.filename, 'reverse_string.py')
    assert.ok(pyResult.code.includes('def reverse_string'))
    assert.ok(pyResult.code.includes('if __name__ == "__main__":'))

    // 3. C Check Prime
    const cResult = synthesizeFallbackDevStarter('Write a C program to check whether a number is prime.', 'C')
    assert.equal(cResult.language, 'C')
    assert.equal(cResult.filename, 'check_prime.c')
    assert.ok(cResult.code.includes('#include <stdio.h>'))
    assert.ok(cResult.code.includes('bool is_prime'))
    assert.ok(cResult.code.includes('int main(void)'))

    // 4. C++ Sort Array
    const cppResult = synthesizeFallbackDevStarter('Write a C++ program to sort an array.', 'C++')
    assert.equal(cppResult.language, 'C++')
    assert.equal(cppResult.filename, 'sort_array.cpp')
    assert.ok(cppResult.code.includes('#include <iostream>'))
    assert.ok(cppResult.code.includes('std::sort'))
    assert.ok(cppResult.code.includes('int main()'))

    // 5. JavaScript Debounce
    const jsResult = synthesizeFallbackDevStarter('Write a JavaScript function to debounce a callback.', 'JavaScript')
    assert.equal(jsResult.language, 'JavaScript')
    assert.equal(jsResult.filename, 'debounce.js')
    assert.ok(jsResult.code.includes('function debounce'))

    // 6. SQL Find Duplicates
    const sqlResult = synthesizeFallbackDevStarter('Write an SQL query to find duplicate records.', 'SQL')
    assert.equal(sqlResult.language, 'SQL')
    assert.equal(sqlResult.filename, 'find_duplicates.sql')
    assert.ok(sqlResult.code.includes('GROUP BY'))
    assert.ok(sqlResult.code.includes('HAVING'))

    // 7. React Component
    const reactResult = synthesizeFallbackDevStarter('Create a React component using TypeScript.', 'React + TypeScript')
    assert.equal(reactResult.language, 'React + TypeScript')
    assert.ok(reactResult.filename.endsWith('.tsx'))
    assert.ok(reactResult.code.includes('import React'))
  })

  await t.test('extractJsonFromResponse parses raw, fenced, and noisy JSON', () => {
    // Clean JSON
    const clean = extractJsonFromResponse<{ hello: string }>('{"hello": "world"}')
    assert.equal(clean.hello, 'world')

    // Fenced JSON
    const fenced = extractJsonFromResponse<{ count: number }>('```json\n{"count": 42}\n```')
    assert.equal(fenced.count, 42)

    // Surrounded with conversational text
    const noisy = extractJsonFromResponse<{ status: string }>('Here is your requested output:\n{"status": "ok"}\nEnjoy!')
    assert.equal(noisy.status, 'ok')
  })

  await t.test('buildOutlineMarkdown formats full slide-by-slide outline', () => {
    const mockOutline: PresentationOutlineResult = {
      topic: 'Q3 Enterprise Growth',
      audience: 'Executive Board',
      slideCount: 2,
      slides: [
        {
          slideNumber: 1,
          kicker: 'STRATEGIC CONTEXT',
          title: 'Opening Thesis',
          talkingPoints: ['Customer retention rose 24%', 'Market expansion into EMEA'],
          visual: 'Quarterly ARR chart showing 38% CAGR',
          speakerNotes: 'Set high energy and emphasize retention metrics.',
        },
        {
          slideNumber: 2,
          kicker: 'THE ASK',
          title: 'Resource Allocation',
          talkingPoints: ['Approval for 5 additional SRE headcount', 'Infrastructure budget'],
          visual: 'Hiring timeline and milestone dependency graph',
          speakerNotes: 'Pause for board questions on budget impact.',
        },
      ],
    }

    const md = buildOutlineMarkdown(mockOutline)
    assert.ok(md.includes('# Q3 Enterprise Growth'))
    assert.ok(md.includes('**Target Audience:** Executive Board'))
    assert.ok(md.includes('## Slide 1: Opening Thesis'))
    assert.ok(md.includes('*STRATEGIC CONTEXT*'))
    assert.ok(md.includes('- Customer retention rose 24%'))
    assert.ok(md.includes('**Suggested Visual:** Quarterly ARR chart'))
    assert.ok(md.includes('**Speaker Notes:** Set high energy'))
    assert.ok(md.includes('## Slide 2: Resource Allocation'))
  })

  await t.test('buildInteractiveDeckHtml generates valid standalone interactive HTML', () => {
    const mockOutline: PresentationOutlineResult = {
      topic: 'AI Product Roadmap',
      audience: 'Core Engineering',
      slideCount: 1,
      slides: [
        {
          slideNumber: 1,
          kicker: 'VISION',
          title: 'Autonomous Workflows',
          talkingPoints: ['Zero-latency local models', 'Row-level security enforcement'],
          visual: 'System architecture diagram',
          speakerNotes: 'Walk through security boundaries.',
        },
      ],
    }

    const html = buildInteractiveDeckHtml(mockOutline)
    assert.ok(html.startsWith('<!doctype html>'))
    assert.ok(html.includes('<title>AI Product Roadmap · NOVA Presentation</title>'))
    assert.ok(html.includes('class="slide-card is-active"'))
    assert.ok(html.includes('VISION'))
    assert.ok(html.includes('Autonomous Workflows'))
    assert.ok(html.includes('Zero-latency local models'))
    assert.ok(html.includes('System architecture diagram'))
    assert.ok(html.includes('Walk through security boundaries.'))
    assert.ok(html.includes('addEventListener(\'keydown\''))
  })
})
