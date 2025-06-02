declare module 'graphviz' {
  interface NodeOptions {
    shape?: string;
    [key: string]: any;
  }

  interface EdgeOptions {
    label?: string;
    [key: string]: any;
  }

  interface Graph {
    addNode(name: string, options?: NodeOptions): void;
    addEdge(from: string, to: string, options?: EdgeOptions): void;
    output(format: string, filename: string): Promise<void>;
  }

  export function digraph(name: string): Graph;
} 