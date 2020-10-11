import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
module Config
{
    export const root = vscel.config.makeRoot(packageJson);
    export const enabled = root.makeEntry<boolean>("bracketLens.enabled");
    export const color = root.makeEntry<string>("bracketLens.color");
    export const prefix = root.makeEntry<string>("bracketLens.prefix");
}
let profilerOutputChannel: vscode.OutputChannel | undefined = undefined;
const getProfilerOutputChannel = () => profilerOutputChannel ?
    profilerOutputChannel:
    (profilerOutputChannel = vscode.window.createOutputChannel("Bracket Lens Profiler"));
export const updateDecoration = (textEditor: vscode.TextEditor) =>
{
    const color = Config.color.get(textEditor.document.languageId);
    const prefix = Config.prefix.get(textEditor.document.languageId);
    const bracketHeaderInformationDecoration = vscode.window.createTextEditorDecorationType
    ({
        isWholeLine: true,
        //color,
    });
    const options: vscode.DecorationOptions[] = [];
    
    const range = textEditor.selections[0];
    const bracketHeader = "";
    options.push
    ({
        range,
        renderOptions:
        {
            after:
            {
                contentText: `${prefix}${bracketHeader}`,
                color,
            }
        }
    });

    textEditor.setDecorations(bracketHeaderInformationDecoration, options);
};
export let extensionContext: vscode.ExtensionContext;
export const activate = async (context: vscode.ExtensionContext) =>
{
    extensionContext = context;
    vscel.profiler.start();
    context.subscriptions.push
    (
        vscode.commands.registerCommand('bracketLens.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World from Bracket Lens!');
        }),
        vscode.commands.registerCommand
        (
            `bracketLens.reportProfile`, () =>
            {
                const outputChannel = getProfilerOutputChannel();
                outputChannel.show();
                if (vscel.profiler.getIsProfiling())
                {
                    outputChannel.appendLine(`${locale.map("📊 Profile Report")} - ${new Date()}`);
                    const overall = vscel.profiler.getOverall();
                    const total = vscel.profiler.getReport().map(i => i.ticks).reduce((p, c) => p +c);
                    outputChannel.appendLine(locale.map("⚖ Overview"));
                    outputChannel.appendLine(`- Overall: ${overall.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(1)} )`);
                    outputChannel.appendLine(`- Busy: ${total.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(total / overall)} )`);
                    outputChannel.appendLine(locale.map("🔬 Busy Details"));
                    outputChannel.appendLine(`- Total: ${total.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(1)} )`);
                    vscel.profiler.getReport().forEach(i => outputChannel.appendLine(`- ${i.name}: ${i.ticks.toLocaleString()}ms ( ${vscel.profiler.percentToDisplayString(i.ticks / total)} )`));
                    outputChannel.appendLine("");
                }
                else
                {
                    outputChannel.appendLine(locale.map("🚫 Profile has not been started."));
                }
            }
        ),
        vscode.workspace.onDidChangeConfiguration
        (
            async (event) =>
            {
                if
                (
                    event.affectsConfiguration("bracketLens")
                )
                {
                    Config.root.entries.forEach(i => i.clear());
                    //await onDidUpdateConfig();
                }
            }
        ),
    );
};
export const deactivate = () => {};
