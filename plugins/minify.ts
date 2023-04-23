import ts from 'typescript';
import * as tstl from 'typescript-to-lua';

const Settings = {
  RenameVariables: true,
  RenameGlobals: false,
  SolveMath: true,
};

const plugin: tstl.Plugin = {
  afterPrint(
    program: ts.Program,
    options: tstl.CompilerOptions,
    emitHost: tstl.EmitHost,
    result: tstl.ProcessedFile[]
  ) {
    for (const file of result) {
      // TODO copy to TX folder?
    }
  },
};

export default plugin;
