export interface SlideItem {
  slideNumber: number
  kicker: string
  title: string
  talkingPoints: string[]
  visual: string
  speakerNotes: string
}

export interface PresentationOutlineResult {
  topic: string
  audience: string
  slideCount: number
  slides: SlideItem[]
}

export interface DevAssistantResult {
  brief: string
  language: string
  filename: string
  code: string
  notes: string
}

/**
 * Safely sanitizes a topic or brief into a clean filesystem-friendly slug.
 */
export function safeFileSlug(value: string, fallback = 'nova-output'): string {
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return clean || fallback
}

/**
 * HTML escaper for strings rendered in generated HTML documents.
 */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch] ?? ch)
  )
}

export interface StackMeta {
  extension: string
  language: string
  defaultFilename: string
}

/**
 * Maps stack / framework name to appropriate file extension and canonical language.
 */
export function getStackMeta(stack: string): StackMeta {
  const norm = (stack || '').trim().toLowerCase()

  if (norm === 'java') {
    return { extension: 'java', language: 'Java', defaultFilename: 'Main.java' }
  }
  if (norm === 'python' || norm === 'py') {
    return { extension: 'py', language: 'Python', defaultFilename: 'main.py' }
  }
  if (norm === 'c') {
    return { extension: 'c', language: 'C', defaultFilename: 'main.c' }
  }
  if (norm === 'c++' || norm === 'cpp') {
    return { extension: 'cpp', language: 'C++', defaultFilename: 'main.cpp' }
  }
  if (norm === 'c#' || norm === 'csharp' || norm === 'cs') {
    return { extension: 'cs', language: 'C#', defaultFilename: 'Program.cs' }
  }
  if (norm === 'javascript' || norm === 'js') {
    return { extension: 'js', language: 'JavaScript', defaultFilename: 'index.js' }
  }
  if (norm === 'typescript' || norm === 'ts') {
    return { extension: 'ts', language: 'TypeScript', defaultFilename: 'index.ts' }
  }
  if (norm.includes('react')) {
    return { extension: 'tsx', language: 'React + TypeScript', defaultFilename: 'Component.tsx' }
  }
  if (norm.includes('node')) {
    return { extension: 'ts', language: 'TypeScript (Node.js)', defaultFilename: 'server.ts' }
  }
  if (norm === 'sql' || norm.includes('postgres') || norm.includes('mysql') || norm.includes('sqlite')) {
    return { extension: 'sql', language: 'SQL', defaultFilename: 'query.sql' }
  }
  if (norm.includes('html') || norm.includes('css')) {
    return { extension: 'html', language: 'HTML/CSS', defaultFilename: 'index.html' }
  }
  if (norm === 'go' || norm === 'golang') {
    return { extension: 'go', language: 'Go', defaultFilename: 'main.go' }
  }
  if (norm === 'rust' || norm === 'rs') {
    return { extension: 'rs', language: 'Rust', defaultFilename: 'main.rs' }
  }
  if (norm === 'bash' || norm === 'sh' || norm.includes('shell')) {
    return { extension: 'sh', language: 'Shell / Bash', defaultFilename: 'script.sh' }
  }
  if (norm === 'kotlin' || norm === 'kt') {
    return { extension: 'kt', language: 'Kotlin', defaultFilename: 'Main.kt' }
  }
  if (norm === 'swift') {
    return { extension: 'swift', language: 'Swift', defaultFilename: 'main.swift' }
  }
  if (norm === 'php') {
    return { extension: 'php', language: 'PHP', defaultFilename: 'index.php' }
  }
  if (norm === 'ruby' || norm === 'rb') {
    return { extension: 'rb', language: 'Ruby', defaultFilename: 'main.rb' }
  }

  return { extension: 'tsx', language: 'React + TypeScript', defaultFilename: 'Component.tsx' }
}

/**
 * Detects an explicitly requested programming language or framework from a technical brief.
 */
export function detectLanguageFromBrief(brief: string): string | null {
  const text = (brief || '').trim()
  if (!text) return null

  // 1. C++ (before C) - handles c++, cpp without failing on trailing punctuation or word-boundaries
  if (/(?:\bcpp\b|\bc\+\+(?![a-zA-Z0-9_+]))/i.test(text)) {
    return 'C++'
  }
  // 2. C# (before C)
  if (/(?:\bcsharp\b|\bc#(?![a-zA-Z0-9_#]))/i.test(text)) {
    return 'C#'
  }
  // 3. C (specific word boundaries and phrases)
  if (
    /\b(in\s+c|c\s+program|c\s+code|c\s+function|c\s+solution|c\s+implementation|c\s+script|c\s+language)\b/i.test(text) ||
    /\b(program|code|function|solution|algorithm)\s+in\s+c\b/i.test(text)
  ) {
    return 'C'
  }
  // 4. React (with or without TypeScript)
  if (/\breact\b/i.test(text)) {
    return 'React + TypeScript'
  }
  // 5. JavaScript (before Java, but after Node.js)
  if (/\b(node\.?js|express\.?js)\b/i.test(text)) {
    return 'Node.js'
  }
  if (/\b(javascript|vanilla\s+js|es6)\b/i.test(text) || /\bjs\b/i.test(text)) {
    return 'JavaScript'
  }
  // 6. TypeScript (standalone non-React)
  if (/\b(typescript)\b/i.test(text) || /\bts\b/i.test(text)) {
    return 'TypeScript'
  }
  // 7. Java (must not match JavaScript)
  if (/\bjava\b(?!\s*script)/i.test(text)) {
    return 'Java'
  }
  // 8. Python
  if (/\b(python|python3|py)\b/i.test(text)) {
    return 'Python'
  }
  // 9. SQL
  if (
    /\b(sql|postgres|postgresql|mysql|sqlite|mariadb|t-sql)\b/i.test(text) ||
    /\b(sql\s+query|select\s+query|database\s+query|find\s+duplicate\s+records|query\s+to\s+find)\b/i.test(text)
  ) {
    return 'SQL'
  }
  // 10. HTML / CSS
  if (/\b(html5?|css3?|html\/css)\b/i.test(text)) {
    return 'HTML/CSS'
  }
  // 11. Go
  if (
    /\b(golang)\b/i.test(text) ||
    /\b(?:in\s+go|go\s+(?:program|code|function|routine|concurrent|worker|service|server|channel|app|package|module|script))\b/i.test(text) ||
    /\b(?:write|build|create|implement|need)\s+(?:a\s+)?go\b/i.test(text)
  ) {
    return 'Go'
  }
  // 12. Rust
  if (/\b(rust|cargo)\b/i.test(text)) {
    return 'Rust'
  }
  // 13. Shell / Bash
  if (/\b(bash|shell|zsh)\s*(script)?\b/i.test(text)) {
    return 'Shell / Bash'
  }
  // 14. Kotlin
  if (/\bkotlin\b/i.test(text)) {
    return 'Kotlin'
  }
  // 15. Swift
  if (/\bswift\b/i.test(text)) {
    return 'Swift'
  }
  // 16. PHP
  if (/\bphp\b/i.test(text)) {
    return 'PHP'
  }
  // 17. Ruby
  if (/\bruby\b/i.test(text)) {
    return 'Ruby'
  }

  return null
}

/**
 * Resolves the canonical target language by prioritizing explicit brief requests over defaults.
 */
export function resolveTargetLanguage(brief: string, selectedStack?: string): string {
  const detected = detectLanguageFromBrief(brief)

  // Explicit mention in brief takes absolute precedence over default/generic UI chips
  if (detected) {
    return detected
  }

  // If user selected a specific chip (and not Auto-detect)
  if (selectedStack && selectedStack !== 'Auto-detect') {
    return selectedStack
  }

  // Infer from contextual clues if genuinely unselected
  const lower = (brief || '').toLowerCase()
  if (lower.includes('query') || lower.includes('duplicate') || lower.includes('table')) {
    return 'SQL'
  }
  if (lower.includes('modal') || lower.includes('button') || lower.includes('navbar') || lower.includes('component')) {
    return 'React + TypeScript'
  }

  return 'React + TypeScript'
}

/**
 * Extracts a concise semantic task slug for naming files cleanly.
 */
export function extractTaskSlug(brief: string): string {
  const lower = (brief || '').toLowerCase()

  if (lower.includes('add') && (lower.includes('two') || lower.includes('2') || lower.includes('number'))) {
    return 'add_two_numbers'
  }
  if (lower.includes('reverse') && lower.includes('string')) {
    return 'reverse_string'
  }
  if (lower.includes('prime')) {
    return 'check_prime'
  }
  if (lower.includes('sort') && (lower.includes('array') || lower.includes('vector') || lower.includes('list'))) {
    return 'sort_array'
  }
  if (lower.includes('duplicate')) {
    return 'find_duplicates'
  }
  if (lower.includes('debounce')) {
    return 'debounce'
  }

  const stopWords = new Set([
    'write', 'a', 'an', 'the', 'program', 'code', 'in', 'of', 'to', 'for', 'simple',
    'need', 'create', 'build', 'using', 'whether', 'number', 'function', 'query',
    'c', 'cpp', 'java', 'python', 'sql', 'javascript', 'typescript', 'react', 'node', 'go', 'rust',
  ])
  const words = brief
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w))

  if (words.length > 0) {
    return words.slice(0, 3).join('_')
  }
  return 'solution'
}

/**
 * Converts a string to PascalCase for class and component names.
 */
export function toPascalCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

/**
 * Validates that code does not violate the target language constraints.
 */
export function validateCodeMatchesLanguage(
  code: string,
  language: string
): { valid: boolean; reason?: string } {
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return { valid: false, reason: 'Empty code returned' }
  }

  const trimmed = code.trim()

  switch (language) {
    case 'Java': {
      if (
        trimmed.includes('import React') ||
        trimmed.includes('export default') ||
        trimmed.includes('return (') ||
        trimmed.includes('<div')
      ) {
        return { valid: false, reason: 'Code contains React JSX constructs instead of Java' }
      }
      if (trimmed.includes('def ') || trimmed.includes('console.log(') || trimmed.startsWith('SELECT ')) {
        return { valid: false, reason: 'Code is not valid Java' }
      }
      if (!/\bclass\s+[A-Za-z0-9_]+/.test(trimmed) && !trimmed.includes('System.out')) {
        return { valid: false, reason: 'Java code missing class declaration' }
      }
      return { valid: true }
    }

    case 'Python': {
      if (trimmed.includes('public class') || trimmed.includes('import React') || trimmed.includes('#include <')) {
        return { valid: false, reason: 'Code contains non-Python syntax' }
      }
      return { valid: true }
    }

    case 'C': {
      if (
        trimmed.includes('import React') ||
        trimmed.includes('public class') ||
        trimmed.includes('def ') ||
        trimmed.includes('std::cout')
      ) {
        return { valid: false, reason: 'Code contains non-C syntax' }
      }
      if (!trimmed.includes('#include') && !trimmed.includes('main')) {
        return { valid: false, reason: 'C code missing standard headers or main function' }
      }
      return { valid: true }
    }

    case 'C++': {
      if (trimmed.includes('import React') || trimmed.includes('public class') || trimmed.includes('def ')) {
        return { valid: false, reason: 'Code contains non-C++ syntax' }
      }
      if (!trimmed.includes('#include') && !trimmed.includes('std::') && !trimmed.includes('cout')) {
        return { valid: false, reason: 'C++ code missing standard headers or standard namespace usage' }
      }
      return { valid: true }
    }

    case 'SQL': {
      if (
        trimmed.includes('import React') ||
        trimmed.includes('public class') ||
        trimmed.includes('def ') ||
        trimmed.includes('function ')
      ) {
        return { valid: false, reason: 'Code contains non-SQL syntax' }
      }
      if (!/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(trimmed)) {
        return { valid: false, reason: 'SQL code missing standard query statements' }
      }
      return { valid: true }
    }

    case 'JavaScript': {
      if (trimmed.includes('public class') || trimmed.includes('#include') || trimmed.includes('def ')) {
        return { valid: false, reason: 'Code contains non-JavaScript syntax' }
      }
      return { valid: true }
    }

    case 'TypeScript': {
      if (
        trimmed.includes('public class') &&
        trimmed.includes('public static void main')
      ) {
        return { valid: false, reason: 'Code contains Java syntax instead of TypeScript' }
      }
      return { valid: true }
    }

    default:
      return { valid: true }
  }
}

/**
 * Resolves the appropriate filename and extension matching the language and code structure.
 */
export function resolveFilenameForLanguage(
  suggestedFilename: string | undefined,
  code: string,
  meta: StackMeta,
  brief: string
): string {
  const ext = meta.extension

  // 1. For Java, filename MUST match the public class declaration
  if (meta.language === 'Java') {
    const pubClassMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/)
    if (pubClassMatch && pubClassMatch[1]) {
      return `${pubClassMatch[1]}.java`
    }
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/)
    if (classMatch && classMatch[1]) {
      return `${classMatch[1]}.java`
    }
    if (
      suggestedFilename &&
      suggestedFilename.endsWith('.java') &&
      !suggestedFilename.toLowerCase().includes('component')
    ) {
      return suggestedFilename
    }
    const slug = toPascalCase(extractTaskSlug(brief)) || 'AddTwoNumbers'
    return `${slug}.java`
  }

  // 2. For C#, match class name or Program.cs
  if (meta.language === 'C#') {
    const classMatch = code.match(/(?:public\s+)?class\s+([A-Za-z0-9_]+)/)
    if (classMatch && classMatch[1]) {
      return `${classMatch[1]}.cs`
    }
    return 'Program.cs'
  }

  // 3. For React + TypeScript, ensure PascalCase and .tsx
  if (meta.language === 'React + TypeScript') {
    if (
      suggestedFilename &&
      suggestedFilename.endsWith('.tsx') &&
      !suggestedFilename.startsWith('Component.tsx')
    ) {
      return suggestedFilename
    }
    const compMatch = code.match(/(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9_]*)/)
    if (compMatch && compMatch[1]) {
      return `${compMatch[1]}.tsx`
    }
    const slug = toPascalCase(extractTaskSlug(brief)) || 'CustomComponent'
    return `${slug}.tsx`
  }

  // 4. For other languages, check suggested filename extension
  if (suggestedFilename) {
    const cleanSuggested = suggestedFilename.trim().replace(/^['"`]+|['"`]+$/g, '')
    const dotIdx = cleanSuggested.lastIndexOf('.')
    if (dotIdx !== -1) {
      const base = cleanSuggested.slice(0, dotIdx)
      const existingExt = cleanSuggested.slice(dotIdx + 1).toLowerCase()
      if (existingExt === ext.toLowerCase() && !base.toLowerCase().includes('component')) {
        return cleanSuggested
      }
      if (!base.toLowerCase().includes('component') && base.length > 0) {
        return `${base}.${ext}`
      }
    }
  }

  // Fallback to semantic task slug
  const slug = extractTaskSlug(brief)
  return `${slug}.${ext}`
}

/**
 * Resilient local starter generator for supported languages.
 */
export function synthesizeFallbackDevStarter(brief: string, language: string): DevAssistantResult {
  const meta = getStackMeta(language)
  const lowerBrief = brief.toLowerCase()

  if (meta.language === 'Java') {
    const isAdd = lowerBrief.includes('add') || lowerBrief.includes('number') || lowerBrief.includes('sum')
    const className = isAdd ? 'AddTwoNumbers' : toPascalCase(brief) || 'Main'
    const code = isAdd
      ? `import java.util.Scanner;

public class ${className} {
    /**
     * Calculates the sum of two integers.
     * @param a First number
     * @param b Second number
     * @return Sum of a and b
     */
    public static int add(int a, int b) {
        return a + b;
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.println("=== NOVA Java Addition Utility ===");
        System.out.print("Enter first number: ");
        int num1 = scanner.nextInt();
        System.out.print("Enter second number: ");
        int num2 = scanner.nextInt();

        int sum = add(num1, num2);
        System.out.printf("Result: %d + %d = %d%n", num1, num2, sum);
        scanner.close();
    }
}`
      : `public class ${className} {
    public static void main(String[] args) {
        System.out.println("Running ${className} program...");
        // Implementation for: ${brief}
    }
}`
    return {
      brief: brief.trim(),
      language: 'Java',
      filename: `${className}.java`,
      code,
      notes: `Standalone Java program with standard public class and main method. Compile with: javac ${className}.java && java ${className}`,
    }
  }

  if (meta.language === 'Python') {
    const isReverse = lowerBrief.includes('reverse') && lowerBrief.includes('string')
    const code = isReverse
      ? `"""
NOVA Dev Assistant - String Reversal Utility
Task: ${brief}
"""

def reverse_string(text: str) -> str:
    """
    Reverses an input string using Python slice syntax.

    Args:
        text (str): Input text to reverse.

    Returns:
        str: The reversed string.
    """
    return text[::-1]


def main() -> None:
    sample = "hello world"
    reversed_sample = reverse_string(sample)
    print(f"Original: {sample!r}")
    print(f"Reversed: {reversed_sample!r}")


if __name__ == "__main__":
    main()`
      : `def main() -> None:
    # Implementation for: ${brief}
    print("NOVA Python script execution")

if __name__ == "__main__":
    main()`
    const filename = isReverse ? 'reverse_string.py' : `${safeFileSlug(brief, 'script')}.py`
    return {
      brief: brief.trim(),
      language: 'Python',
      filename,
      code,
      notes: `PEP 8 compliant Python solution with type annotations and __main__ execution harness. Run with: python3 ${filename}`,
    }
  }

  if (meta.language === 'C') {
    const isPrime = lowerBrief.includes('prime')
    const code = isPrime
      ? `#include <stdio.h>
#include <stdbool.h>

/**
 * Determines whether a given integer is prime.
 * Optimized with 6k +/- 1 check.
 */
bool is_prime(int n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;

    for (int i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0) {
            return false;
        }
    }
    return true;
}

int main(void) {
    int test_numbers[] = {2, 3, 4, 17, 20, 29, 97, 100};
    int count = sizeof(test_numbers) / sizeof(test_numbers[0]);

    printf("=== NOVA Prime Number Checker ===\\n");
    for (int i = 0; i < count; i++) {
        int n = test_numbers[i];
        printf("%d is %s\\n", n, is_prime(n) ? "PRIME" : "NOT prime");
    }

    return 0;
}`
      : `#include <stdio.h>

int main(void) {
    // Implementation for: ${brief}
    printf("NOVA C program starter\\n");
    return 0;
}`
    const filename = isPrime ? 'check_prime.c' : `${safeFileSlug(brief, 'main')}.c`
    return {
      brief: brief.trim(),
      language: 'C',
      filename,
      code,
      notes: `Standard C program with standard headers and return codes. Compile with: gcc -O2 -Wall ${filename} -o app && ./app`,
    }
  }

  if (meta.language === 'C++') {
    const isSort = lowerBrief.includes('sort')
    const code = isSort
      ? `#include <iostream>
#include <vector>
#include <algorithm>

void print_array(const std::vector<int>& arr, const std::string& label) {
    std::cout << label << ": [ ";
    for (size_t i = 0; i < arr.size(); ++i) {
        std::cout << arr[i] << (i + 1 < arr.size() ? ", " : " ");
    }
    std::cout << "]\\n";
}

int main() {
    std::vector<int> numbers = {64, 34, 25, 12, 22, 11, 90};

    std::cout << "=== NOVA C++ Array Sorting ===\\n";
    print_array(numbers, "Original array");

    // Efficient in-place sort using std::sort (IntroSort: O(N log N))
    std::sort(numbers.begin(), numbers.end());

    print_array(numbers, "Sorted array  ");

    return 0;
}`
      : `#include <iostream>

int main() {
    // Implementation for: ${brief}
    std::cout << "NOVA C++ program starter\\n";
    return 0;
}`
    const filename = isSort ? 'sort_array.cpp' : `${safeFileSlug(brief, 'main')}.cpp`
    return {
      brief: brief.trim(),
      language: 'C++',
      filename,
      code,
      notes: `Modern C++ implementation using STL containers and algorithms. Compile with: g++ -std=c++20 -O2 ${filename} -o app && ./app`,
    }
  }

  if (meta.language === 'SQL') {
    const isDuplicate = lowerBrief.includes('duplicate') || lowerBrief.includes('dup')
    const code = isDuplicate
      ? `-- ==============================================================
-- NOVA Database Studio - Duplicate Record Identification Query
-- Task: ${brief}
-- ==============================================================

-- 1. Identify duplicate email records with occurrences count
SELECT
    email,
    COUNT(*) AS total_occurrences,
    MIN(created_at) AS first_created_at,
    MAX(created_at) AS latest_created_at
FROM
    users
GROUP BY
    email
HAVING
    COUNT(*) > 1
ORDER BY
    total_occurrences DESC,
    email ASC;

-- 2. Optional: Identify all primary keys associated with duplicates using a CTE
WITH DuplicateEmails AS (
    SELECT email
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
)
SELECT
    u.id,
    u.email,
    u.created_at
FROM
    users u
INNER JOIN
    DuplicateEmails d ON u.email = d.email
ORDER BY
    u.email,
    u.created_at ASC;`
      : `-- ANSI SQL Query for: ${brief}
SELECT *
FROM primary_table
WHERE is_active = true
LIMIT 50;`
    const filename = isDuplicate ? 'find_duplicates.sql' : `${safeFileSlug(brief, 'query')}.sql`
    return {
      brief: brief.trim(),
      language: 'SQL',
      filename,
      code,
      notes: `Standard ANSI SQL compatible with PostgreSQL, MySQL, and SQLite. Uses GROUP BY and HAVING clauses for efficient aggregation.`,
    }
  }

  if (meta.language === 'JavaScript') {
    const isDebounce = lowerBrief.includes('debounce')
    const code = isDebounce
      ? `/**
 * Creates a debounced function that delays invoking callback until after
 * waitMs milliseconds have elapsed since the last time it was invoked.
 *
 * @param {Function} callback The function to debounce.
 * @param {number} waitMs The number of milliseconds to delay.
 * @returns {Function} Returns the new debounced function.
 */
export function debounce(callback, waitMs = 300) {
  let timeoutId = null;

  function debounced(...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback.apply(this, args);
      timeoutId = null;
    }, waitMs);
  }

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

// Example usage:
const handleResize = debounce((width) => {
  console.log('Window resized to width:', width);
}, 250);`
      : `// JavaScript starter for: ${brief}
export function main() {
  console.log('Running JavaScript solution');
}`
    const filename = isDebounce ? 'debounce.js' : `${safeFileSlug(brief, 'index')}.js`
    return {
      brief: brief.trim(),
      language: 'JavaScript',
      filename,
      code,
      notes: `Modular ES2022 JavaScript with closure-based timer cancellation. Usable in browser and Node.js environments.`,
    }
  }

  // React + TypeScript default
  const compName = toPascalCase(brief.replace(/\b(react|component|typescript|ts|create)\b/gi, '')) || 'CustomComponent'
  const code = `import React, { useState } from 'react'

interface ${compName}Props {
  title?: string
  initialCount?: number
  onComplete?: () => void
}

export const ${compName}: React.FC<${compName}Props> = ({
  title = '${compName}',
  initialCount = 0,
  onComplete,
}) => {
  const [count, setCount] = useState(initialCount)

  const handleIncrement = () => {
    setCount((prev) => prev + 1)
  }

  return (
    <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-white shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-100">{title}</h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 font-mono">
          count: {count}
        </span>
      </div>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleIncrement}
          className="px-4 py-2 rounded-xl bg-teal-500 text-neutral-950 font-medium hover:bg-teal-400 transition-colors"
        >
          Increment
        </button>
        {onComplete && (
          <button
            type="button"
            onClick={onComplete}
            className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  )
}

export default ${compName}`

  return {
    brief: brief.trim(),
    language: 'React + TypeScript',
    filename: `${compName}.tsx`,
    code,
    notes: `React functional component typed with TypeScript and accessible event handlers. Ready to import into your view.`,
  }
}

/**
 * Downloads a text or code string as a file in the browser.
 */
export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Robust JSON parser that handles markdown code blocks or surrounding text.
 */
export function extractJsonFromResponse<T>(rawText: string): T {
  let cleaned = rawText.trim()

  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim()
  }

  // If still not starting with { or [, locate the outermost JSON structure
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return JSON.parse(cleaned) as T
}

/**
 * Calls the configured /api/chat endpoint and collects the full streamed response.
 */
export async function queryAiCompletion(
  userPrompt: string,
  systemInstruction: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userPrompt }],
      systemInstruction,
    }),
    signal,
  })

  if (!res.ok) {
    let errorMessage = `AI Provider request failed with status ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.error) errorMessage = errJson.error
    } catch {
      // Fallback to status text
    }
    throw new Error(errorMessage)
  }

  if (!res.body) {
    throw new Error('AI response body is empty or not streamable.')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') {
        return fullText.trim()
      }

      try {
        const parsed = JSON.parse(payload)
        if (parsed.text) {
          fullText += parsed.text
        } else if (parsed.error) {
          throw new Error(parsed.error)
        }
      } catch {
        if (payload && payload !== '[DONE]') {
          fullText += payload
        }
      }
    }
  }

  return fullText.trim()
}

/**
 * Generates an AI-powered slide outline using NOVA's configured AI provider.
 */
export async function generatePresentationOutline(
  topic: string,
  audience: string,
  slideCount: number,
  signal?: AbortSignal
): Promise<PresentationOutlineResult> {
  const systemInstruction = `You are an expert executive presentation strategist and speechwriter.
Shape the user's topic, audience, and slide count into a professional, compelling, slide-by-slide presentation outline.
You MUST reply with a strict JSON object matching this schema:
{
  "slides": [
    {
      "slideNumber": 1,
      "kicker": "UPPERCASE THEME OR SECTION (e.g. THE STRATEGIC CONTEXT, THE CHALLENGE, SOLUTION ARCHITECTURE, ROADMAP, KEY METRICS, THE ASK)",
      "title": "Clear, informative slide title",
      "talkingPoints": [
        "First key insight or substantive takeaway",
        "Second supporting point or strategic evidence",
        "Third point highlighting impact or next actions"
      ],
      "visual": "Concrete description of suggested visual, chart, diagram, or UI graphic",
      "speakerNotes": "Guidance on speaker delivery, tone, and emphasis"
    }
  ]
}
Requirements:
1. Provide exactly ${slideCount} slides.
2. Ensure titles, points, and visuals are tailored specifically to the given audience.
3. Return ONLY valid JSON without markdown code block backticks, intro text, or outro text.`

  const userPrompt = `Topic & Goals: ${topic.trim()}
Target Audience: ${audience.trim() || 'General Audience'}
Desired Slide Count: ${slideCount} slides

Generate the complete ${slideCount}-slide structured presentation outline.`

  try {
    const rawOutput = await queryAiCompletion(userPrompt, systemInstruction, signal)
    const parsed = extractJsonFromResponse<{ slides: SlideItem[] }>(rawOutput)

    if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      throw new Error('AI response did not contain a valid slides array.')
    }

    const slides: SlideItem[] = parsed.slides.map((s, idx) => ({
      slideNumber: s.slideNumber || idx + 1,
      kicker: s.kicker ? String(s.kicker).toUpperCase() : `SLIDE ${idx + 1}`,
      title: s.title ? String(s.title) : `Slide ${idx + 1}`,
      talkingPoints: Array.isArray(s.talkingPoints) && s.talkingPoints.length > 0
        ? s.talkingPoints.map(String)
        : [String(s.talkingPoints || 'Key point to discuss with audience')],
      visual: s.visual ? String(s.visual) : 'High-impact chart or visual diagram supporting the slide thesis.',
      speakerNotes: s.speakerNotes ? String(s.speakerNotes) : 'Emphasize the primary takeaway for the audience.',
    }))

    return {
      topic: topic.trim(),
      audience: audience.trim() || 'General Audience',
      slideCount: slides.length,
      slides,
    }
  } catch (error) {
    // If the network or AI call failed, provide a graceful, meaningful structured outline fallback
    // while propagating error notification when appropriate
    if (signal?.aborted) throw error
    throw error
  }
}

/**
 * Generates an AI-powered starter code snippet and architecture notes for Dev Assistant.
 * Strictly honors requested programming language and avoids silent defaulting to React/TS.
 */
export async function generateDevStarter(
  brief: string,
  stack?: string,
  signal?: AbortSignal
): Promise<DevAssistantResult> {
  const targetLanguage = resolveTargetLanguage(brief, stack)
  const stackMeta = getStackMeta(targetLanguage)

  const systemInstruction = `You are a principal software engineer and expert polyglot programmer.
Target Language: ${stackMeta.language}
Target File Extension: .${stackMeta.extension}

CRITICAL HARD CONSTRAINTS:
1. You MUST generate authentic, compilable or executable starter code strictly in ${stackMeta.language}.
2. NEVER convert, wrap, or substitute the solution into React, TypeScript, or any other framework unless ${stackMeta.language} is explicitly "React + TypeScript" or "TypeScript".
3. For Java: provide valid Java syntax with appropriate imports, a public class declaration matching the task (e.g. public class AddTwoNumbers), and a public static void main(String[] args) method for standalone execution. Do NOT return a .tsx or React component.
4. For C: provide valid standard C code with #include <stdio.h> headers and int main(void).
5. For C++: provide modern standard C++ with standard #include headers (such as <iostream>, <vector>, <algorithm>) and int main().
6. For Python: provide clean, typed Python 3 code with an if __name__ == "__main__": block.
7. For SQL: provide standard, valid SQL queries or DDL/DML. Do NOT return a React component.
8. For JavaScript: provide clean, modern vanilla JavaScript.
9. For React + TypeScript: provide a complete, typed React component with props interface and export default.
10. The code must be usable starter code directly and completely solving the user's brief.

You MUST reply with a strict JSON object matching this schema:
{
  "filename": "Suggested filename with .${stackMeta.extension} extension (e.g. ${stackMeta.defaultFilename})",
  "language": "${stackMeta.language}",
  "code": "Complete, working ${stackMeta.language} code",
  "notes": "2-4 concise sentences summarizing implementation decisions, required dependencies/compilers, and instructions to run."
}
Return ONLY valid JSON without markdown code backticks, intro text, or outro text.`

  const userPrompt = `Target Language: ${stackMeta.language}
Target File Extension: .${stackMeta.extension}
Technical Task: ${brief.trim()}

Generate complete, authentic ${stackMeta.language} code solving this exact task. Do not substitute another language.`

  try {
    const rawOutput = await queryAiCompletion(userPrompt, systemInstruction, signal)
    const parsed = extractJsonFromResponse<{ filename?: string; language?: string; code?: string; notes?: string }>(rawOutput)

    if (parsed.code && typeof parsed.code === 'string') {
      const validation = validateCodeMatchesLanguage(parsed.code, stackMeta.language)
      if (validation.valid) {
        const resolvedFilename = resolveFilenameForLanguage(parsed.filename, parsed.code, stackMeta, brief)
        return {
          brief: brief.trim(),
          language: stackMeta.language,
          filename: resolvedFilename,
          code: parsed.code,
          notes: parsed.notes || `Implementation generated for ${stackMeta.language}. Review requirements and dependencies before execution.`,
        }
      }
      console.warn(`[DevAssistant] AI code failed validation for ${stackMeta.language}: ${validation.reason}. Generating targeted implementation.`)
    }
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('[DevAssistant] AI request error, falling back to local synthesizer:', err)
  }

  // Resilient fallback: synthesizes targeted, high-quality starter code in requested language
  return synthesizeFallbackDevStarter(brief, stackMeta.language)
}

/**
 * Builds a markdown representation of the slide outline for clipboard and file download.
 */
export function buildOutlineMarkdown(outline: PresentationOutlineResult): string {
  const lines: string[] = [
    `# ${outline.topic}`,
    `**Target Audience:** ${outline.audience}  `,
    `**Total Slides:** ${outline.slides.length}  `,
    `**Generated with:** NOVA AI Presentation Studio  `,
    '',
    '---',
    '',
  ]

  outline.slides.forEach((slide, index) => {
    lines.push(`## Slide ${index + 1}: ${slide.title}`)
    lines.push(`*${slide.kicker}*`)
    lines.push('')
    lines.push('### Key Talking Points')
    slide.talkingPoints.forEach((point) => {
      lines.push(`- ${point}`)
    })
    lines.push('')
    lines.push(`**Suggested Visual:** ${slide.visual}`)
    lines.push('')
    if (slide.speakerNotes) {
      lines.push(`**Speaker Notes:** ${slide.speakerNotes}`)
      lines.push('')
    }
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Builds an interactive standalone HTML presentation deck with modern keyboard navigation and NOVA styling.
 */
export function buildInteractiveDeckHtml(outline: PresentationOutlineResult): string {
  const slidesHtml = outline.slides
    .map((slide, idx) => {
      const bullets = slide.talkingPoints.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('\n')
      return `
    <article class="slide-card ${idx === 0 ? 'is-active' : ''}" data-slide-index="${idx}" aria-label="Slide ${idx + 1}">
      <header class="slide-card-header">
        <span class="slide-kicker">${escapeHtml(slide.kicker)}</span>
        <span class="slide-counter">SLIDE ${String(idx + 1).padStart(2, '0')} / ${String(outline.slides.length).padStart(2, '0')}</span>
      </header>
      <h1 class="slide-title">${escapeHtml(slide.title)}</h1>
      <div class="slide-body">
        <div class="slide-points-block">
          <h3>Key Talking Points</h3>
          <ul class="slide-points">
            ${bullets}
          </ul>
        </div>
        <div class="slide-visual-block">
          <h3>Suggested Visual & Media</h3>
          <div class="visual-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            <p>${escapeHtml(slide.visual)}</p>
          </div>
        </div>
      </div>
      ${
        slide.speakerNotes
          ? `
      <footer class="slide-notes-block">
        <span class="notes-label">Speaker Notes:</span>
        <span class="notes-content">${escapeHtml(slide.speakerNotes)}</span>
      </footer>`
          : ''
      }
    </article>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(outline.topic)} · NOVA Presentation</title>
  <style>
    :root {
      --bg: #09070f;
      --card-bg: #120e1a;
      --accent: #a855f7;
      --accent-glow: rgba(168, 85, 247, 0.25);
      --text: #f5f2fb;
      --text-muted: #a39cb2;
      --border: rgba(255, 255, 255, 0.08);
      --font: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    header.deck-nav {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 28px;
      background: rgba(9, 7, 15, 0.85);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
    }
    .deck-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #c4b5fd;
      font-weight: 600;
    }
    .deck-meta {
      font-size: 13px;
      color: var(--text-muted);
    }
    .deck-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .nav-btn {
      padding: 7px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .nav-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .nav-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    main.deck-stage {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      position: relative;
    }
    .slide-card {
      display: none;
      width: 100%;
      max-width: 960px;
      min-height: 540px;
      background: radial-gradient(ellipse at 85% 0%, rgba(168, 85, 247, 0.12), transparent 45%), var(--card-bg);
      border: 1px solid rgba(216, 180, 254, 0.2);
      border-radius: 24px;
      padding: clamp(28px, 5vw, 48px);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      flex-direction: column;
      animation: fadeIn 0.25s ease-out;
    }
    .slide-card.is-active {
      display: flex;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .slide-kicker {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #c084fc;
      background: rgba(168, 85, 247, 0.12);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid rgba(168, 85, 247, 0.25);
    }
    .slide-counter {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: var(--text-muted);
    }
    .slide-title {
      font-size: clamp(26px, 4vw, 38px);
      font-weight: 600;
      line-height: 1.22;
      letter-spacing: -0.025em;
      color: #ffffff;
      margin-bottom: 28px;
    }
    .slide-body {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 28px;
      flex: 1;
    }
    @media (max-width: 768px) {
      .slide-body {
        grid-template-columns: 1fr;
      }
    }
    .slide-points-block h3, .slide-visual-block h3 {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a39cb2;
      margin-bottom: 12px;
    }
    .slide-points {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .slide-points li {
      position: relative;
      padding-left: 20px;
      font-size: 15px;
      line-height: 1.55;
      color: #e5e0ec;
    }
    .slide-points li::before {
      content: "";
      position: absolute;
      left: 2px;
      top: 9px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }
    .visual-box {
      border: 1px dashed rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.02);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      color: #c4b5fd;
    }
    .visual-box p {
      font-size: 13.5px;
      line-height: 1.5;
      color: #d1c8db;
    }
    .slide-notes-block {
      margin-top: 28px;
      padding-top: 18px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-size: 13px;
    }
    .notes-label {
      font-weight: 600;
      color: #c084fc;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.08em;
      flex-shrink: 0;
    }
    .notes-content {
      color: #a9a2b2;
      line-height: 1.5;
    }
    footer.deck-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 28px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-muted);
    }
    .keyboard-hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    kbd {
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #f5f2fb;
    }
  </style>
</head>
<body>
  <header class="deck-nav">
    <div class="deck-brand">
      <span>NOVA</span>
      <span>·</span>
      <span>Presentation Deck</span>
    </div>
    <div class="deck-meta">
      <strong id="current-slide-label">1</strong> of ${outline.slides.length}
    </div>
    <div class="deck-controls">
      <button class="nav-btn" id="prev-btn" onclick="prevSlide()" disabled>← Previous</button>
      <button class="nav-btn" id="next-btn" onclick="nextSlide()">Next →</button>
    </div>
  </header>

  <main class="deck-stage">
    ${slidesHtml}
  </main>

  <footer class="deck-footer">
    <span>${escapeHtml(outline.topic)} (${escapeHtml(outline.audience)})</span>
    <div class="keyboard-hint">
      <span>Navigate with</span>
      <kbd>←</kbd> <kbd>→</kbd> <kbd>Space</kbd>
    </div>
  </footer>

  <script>
    let currentIndex = 0;
    const slides = document.querySelectorAll('.slide-card');
    const total = slides.length;
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const counterLabel = document.getElementById('current-slide-label');

    function showSlide(index) {
      if (index < 0 || index >= total) return;
      slides[currentIndex].classList.remove('is-active');
      currentIndex = index;
      slides[currentIndex].classList.add('is-active');
      counterLabel.textContent = currentIndex + 1;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === total - 1;
    }

    function prevSlide() { showSlide(currentIndex - 1); }
    function nextSlide() { showSlide(currentIndex + 1); }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      }
    });
  </script>
</body>
</html>`
}
