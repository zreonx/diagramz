export interface ValidationResult {
  isValid: boolean;
  diagramType: string;
  mermaidCode: string;
  error?: string;
}

const ALLOWED_DIAGRAM_TYPES = [
  'flowchart',
  'graph',
  'sequencediagram',
  'classdiagram',
  'erdiagram',
  'statediagram',
  'statediagram-v2',
  'mindmap',
  'gantt',
  'gitgraph',
  'c4context',
];

export function validateMermaidCode(rawText: string): ValidationResult {
  // Extract block if enclosed in ```mermaid ... ```
  let code = rawText.trim();
  const match = code.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (match) {
    code = match[1].trim();
  }

  if (!code) {
    return {
      isValid: false,
      diagramType: 'unknown',
      mermaidCode: '',
      error: 'Empty Mermaid code provided',
    };
  }

  // Identify first non-comment non-empty line
  const lines = code.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('%%'));
  if (lines.length === 0) {
    return {
      isValid: false,
      diagramType: 'unknown',
      mermaidCode: code,
      error: 'No valid diagram directives found',
    };
  }

  const firstToken = lines[0].toLowerCase().split(/[\s(]/)[0];
  const isAllowed = ALLOWED_DIAGRAM_TYPES.some((type) => firstToken.startsWith(type));

  if (!isAllowed) {
    return {
      isValid: false,
      diagramType: firstToken,
      mermaidCode: code,
      error: `Unsupported or invalid diagram type directive: "${firstToken}". Allowed types: ${ALLOWED_DIAGRAM_TYPES.join(', ')}`,
    };
  }

  // Basic syntax safeguards: balanced brackets/parentheses in node declarations
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (openBraces !== closeBraces) {
    return {
      isValid: false,
      diagramType: firstToken,
      mermaidCode: code,
      error: 'Unbalanced curly braces { } in diagram definition',
    };
  }

  return {
    isValid: true,
    diagramType: firstToken,
    mermaidCode: code,
  };
}
