/* eslint-disable @typescript-eslint/no-explicit-any */
import * as assert from "assert"

// Test the boundary detection patterns used in completion.ts

suite("Completion Boundary Detection", () => {
  suite("Statement terminator pattern", () => {
    const endsWithStatementTerminator = /[})]\s*;?\s*$/

    test("should match }", () => {
      assert.ok(endsWithStatementTerminator.test("foo }"))
      assert.ok(endsWithStatementTerminator.test("foo { bar }"))
    })

    test("should match })", () => {
      assert.ok(endsWithStatementTerminator.test("foo }))"))
      assert.ok(endsWithStatementTerminator.test("call({ })"))
    })

    test("should match }));", () => {
      assert.ok(endsWithStatementTerminator.test("foo }));"))
      assert.ok(endsWithStatementTerminator.test("vi.mock(\"./file\", () => ({ foo: \"bar\" }));"))
    })

    test("should match });", () => {
      assert.ok(endsWithStatementTerminator.test("foo });"))
      assert.ok(endsWithStatementTerminator.test("callback({ foo: bar });"))
    })

    test("should match };", () => {
      assert.ok(endsWithStatementTerminator.test("const obj = {};"))
      assert.ok(endsWithStatementTerminator.test("const x = { foo: bar };"))
    })

    test("should match );", () => {
      assert.ok(endsWithStatementTerminator.test("foo());"))
      assert.ok(endsWithStatementTerminator.test("call(args);"))
    })

    test("should not match incomplete patterns", () => {
      assert.ok(!endsWithStatementTerminator.test("foo {"))
      assert.ok(!endsWithStatementTerminator.test("foo ("))
      assert.ok(endsWithStatementTerminator.test("foo } ")) // trailing space is ok
    })
  })

  suite("End pattern detection", () => {
    const hasEndPattern = /\}\s*$|\)\s*$|\]\s*$|;\s*$/

    test("should match closing brace", () => {
      assert.ok(hasEndPattern.test("foo }"))
      assert.ok(hasEndPattern.test("foo }   "))
    })

    test("should match closing paren", () => {
      assert.ok(hasEndPattern.test("foo )"))
      assert.ok(hasEndPattern.test("foo )   "))
    })

    test("should match closing bracket", () => {
      assert.ok(hasEndPattern.test("foo ]"))
      assert.ok(hasEndPattern.test("foo ]   "))
    })

    test("should match semicolon", () => {
      assert.ok(hasEndPattern.test("foo ;"))
      assert.ok(hasEndPattern.test("foo ;   "))
    })
  })

  suite("Structural boundary pattern", () => {
    const structuralBoundaryPattern = /\}\s*\n(\s*)\S+/m

    test("should match closing brace followed by new statement", () => {
      const text = "foo }\n  bar()"
      const match = text.match(structuralBoundaryPattern)
      assert.ok(match)
      assert.strictEqual(match?.[1], "  ")
    })

    test("should match with varying indentation", () => {
      const text = "function() { }\nconst x = 1"
      const match = text.match(structuralBoundaryPattern)
      assert.ok(match)
      assert.strictEqual(match?.[1], "")
    })

    test("should not match without new statement", () => {
      const text = "foo }\n  "
      assert.ok(!text.match(structuralBoundaryPattern))
    })

    test("should not match in same line", () => {
      const text = "foo } bar()"
      assert.ok(!text.match(structuralBoundaryPattern))
    })
  })

  suite("Empty line detection", () => {
    const endsWithEmptyLine = /\n\s*\n\s*$/

    test("should match double newline", () => {
      assert.ok(endsWithEmptyLine.test("foo\n\n"))
    })

    test("should match with whitespace", () => {
      assert.ok(endsWithEmptyLine.test("foo\n  \n  "))
    })

    test("should not match single newline", () => {
      assert.ok(!endsWithEmptyLine.test("foo\n"))
    })
  })

  suite("Indentation return detection", () => {
    function checkIndentationReturned(completion: string): boolean {
      const lines = completion.split("\n")
      if (lines.length <= 2) return false

      const lastLineIndent = lines[lines.length - 1].length - lines[lines.length - 1].trimStart().length
      const firstLineIndent = lines[0].length - lines[0].trimStart().length

      return lastLineIndent <= firstLineIndent
    }

    test("should detect when indentation returns to original level", () => {
      const completion = "  foo\n    bar\n  baz"
      assert.ok(checkIndentationReturned(completion))
    })

    test("should detect when indentation goes to outer level", () => {
      const completion = "    foo\n      bar\n    baz"
      assert.ok(checkIndentationReturned(completion))
    })

    test("should not trigger with only 2 lines", () => {
      const completion = "  foo\n  bar"
      assert.ok(!checkIndentationReturned(completion))
    })

    test("should not trigger when still indented", () => {
      const completion = "foo\n  bar\n    baz"
      assert.ok(!checkIndentationReturned(completion))
    })
  })

  suite("Bracket balance detection", () => {
    function checkBracketBalance(text: string): boolean {
      let openBraces = 0
      let openParens = 0
      let openBrackets = 0

      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        switch (char) {
          case "{":
            openBraces++
            break
          case "}":
            openBraces--
            break
          case "(": 
            openParens++
            break
          case ")":
            openParens--
            break
          case "[":
            openBrackets++
            break
          case "]":
            openBrackets--
            break
        }
      }

      return openBraces === 0 && openParens === 0 && openBrackets === 0
    }

    test("should detect balanced brackets", () => {
      assert.ok(checkBracketBalance("foo { bar } baz"))
      assert.ok(checkBracketBalance("foo ( bar ) baz"))
      assert.ok(checkBracketBalance("foo [ bar ] baz"))
      assert.ok(checkBracketBalance("{ ([{}]) }"))
    })

    test("should detect unbalanced brackets", () => {
      assert.ok(checkBracketBalance("foo { bar }"))
      assert.ok(!checkBracketBalance("foo { bar "))
      assert.ok(checkBracketBalance("foo ( bar )"))
      assert.ok(!checkBracketBalance("foo ( bar "))
      assert.ok(checkBracketBalance("foo [ bar ]"))
      assert.ok(!checkBracketBalance("foo [ bar "))
    })

    test("should handle nested brackets", () => {
      assert.ok(checkBracketBalance("{ foo: { bar: baz } }"))
      assert.ok(!checkBracketBalance("{ foo: { bar: baz }"))
      assert.ok(checkBracketBalance("function() { return { x: 1 }; }"))
    })
  })

  suite("Real-world completion scenarios", () => {
    const endsWithStatementTerminator = /[})]\s*;?\s*$/
    const structuralBoundaryPattern = /\}\s*\n(\s*)\S+/m

    test("should stop at vi.mock ending", () => {
      const completion = `vi.mock('./hooks/useIde', () => ({
  useIde: vi.fn(() => ({
    ide: 'vscode',
  })),
}));`
      assert.ok(endsWithStatementTerminator.test(completion))
    })

    test("should stop at callback ending", () => {
      const completion = `callback({
  foo: 'bar',
  baz: 'qux',
});`
      assert.ok(endsWithStatementTerminator.test(completion))
    })

    test("should detect structural boundary after function", () => {
      const completion = `function foo() {
  return bar;
}
const next = 1;`
      assert.ok(structuralBoundaryPattern.test(completion))
    })

    test("should handle arrow function in object", () => {
      const completion = `{
  foo: () => {
    return bar;
  },
}`
      // Should not stop prematurely - no statement terminator at the end
      assert.ok(!endsWithStatementTerminator.test(completion))
    })

    test("should stop at IIFE ending", () => {
      const completion = `(function() {
  console.log('test');
})();`
      assert.ok(endsWithStatementTerminator.test(completion))
    })

    test("should stop at class method ending", () => {
      const completion = `class Foo {
  method() {
    return 1;
  }
}`
      assert.ok(!endsWithStatementTerminator.test(completion)) // No ; at end
      // But structural boundary would catch the newline after }
    })
  })
})