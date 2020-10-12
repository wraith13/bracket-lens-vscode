import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
const profile = vscel.profiler.profile;
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
interface BracketEntry
{
    start: vscode.Position;
    end: vscode.Position;
    items: BracketEntry[];
}
export const parseBrackets = (document: vscode.TextDocument) => profile
(
    "parseBrackets",
    (): BracketEntry[] =>
    {
        const result:BracketEntry[] = [];

        return result;
    }
);
export const getBracketHeader = (document: vscode.TextDocument, entry: BracketEntry) => profile
(
    "getBracketHeader",
    (): string =>
    {
        return "";
    }
);
export const getBracketDecorationSource = (textEditor: vscode.TextEditor) => profile
(
    "getBracketDecorationSource",
    () =>
    {
        const result:{
            range: vscode.Range,
            bracketHeader: string,
        }[] = [];
        const scanner = (entry: BracketEntry) =>
        {
            if (entry.start.line < entry.end.line)
            {
                const bracketHeader = getBracketHeader(textEditor.document, entry);
                if (0 < bracketHeader.length)
                {
                    result.push
                    ({
                        range: new vscode.Range(new vscode.Position(entry.end.line, entry.end.character -1), entry.end),
                        bracketHeader,
                    });
                }
                entry.items.map(scanner);
            }
        };
        parseBrackets(textEditor.document).map(scanner);

        //  ここで刈り込み

        return result;
    }
);
export const updateDecoration = (textEditor: vscode.TextEditor) => profile
(
    "updateDecoration",
    () =>
    {
        const color = Config.color.get(textEditor.document.languageId);
        const prefix = Config.prefix.get(textEditor.document.languageId);
        const bracketHeaderInformationDecoration = vscode.window.createTextEditorDecorationType
        ({
            isWholeLine: true,
            //color,
        });
        const data = getBracketDecorationSource(textEditor);
        const options: vscode.DecorationOptions[] = data.map
        (
            i =>
            ({
                range: i.range,
                renderOptions:
                {
                    after:
                    {
                        contentText: `${prefix}${i.bracketHeader}`,
                        color,
                    }
                }
            })
        );
        profile
        (
            "textEditor.setDecorations",
            () => textEditor.setDecorations
            (
                bracketHeaderInformationDecoration,
                options
            )
        );
    }
);
export const onDidChangeConfiguration = () =>
{
    Config.root.entries.forEach(i => i.clear());
};
class DocumentDecorationCacheEntry
{
    brackets: BracketEntry[];
    public constructor(document: vscode.TextDocument)
    {
        this.brackets = parseBrackets(document);
    }
}
class EditorDecorationCacheEntry
{
    selection: vscode.Selection;
    public constructor
    (
        textEditor: vscode.TextEditor,
        currentDocumentDecorationCache: DocumentDecorationCacheEntry,
        previousEditorDecorationCache? :EditorDecorationCacheEntry
    )
    {
    }
}
const documentDecorationCache = new Map<vscode.TextDocument, DocumentDecorationCacheEntry>();
const editorDecorationCache = new Map<vscode.TextEditor, EditorDecorationCacheEntry>();
const valueThen = <ValueT, ResultT>(value: ValueT | undefined, f: (value: ValueT) => ResultT) =>
{
    if (value)
    {
        return f(value);
    }
    return undefined;
};
const activeTextEditor = <T>(f: (textEditor: vscode.TextEditor) => T) => valueThen(vscode.window.activeTextEditor, f);
export const clearDecorationCache = (document?: vscode.TextDocument): void =>
{
    if (document)
    {
        documentDecorationCache.delete(document);
        for(const textEditor of editorDecorationCache.keys())
        {
            if (document === textEditor.document)
            {
                editorDecorationCache.delete(textEditor);
            }
        }
    }
    else
    {
        for(const textEditor of editorDecorationCache.keys())
        {
            if (vscode.window.visibleTextEditors.indexOf(textEditor) < 0)
            {
                editorDecorationCache.delete(textEditor);
            }
        }
    }
};
const getDocumentTextLength = (document: vscode.TextDocument) => document.offsetAt
(
    document.lineAt(document.lineCount - 1).range.end
);
//const isClip = (lang: string, textLength: number) => clipByVisibleRange.get(lang)(textLength / Math.max(fileSizeLimit.get(lang), 1024));
const lastUpdateStamp = new Map<vscode.TextEditor, number>();
export const delayUpdateDecoration = (textEditor: vscode.TextEditor): void =>
{
    const updateStamp = vscel.profiler.getTicks();
    lastUpdateStamp.set(textEditor, updateStamp);
    const textLength = getDocumentTextLength(textEditor.document);
    const logUnit = 16 *1024;
    const logRate = Math.pow(Math.max(textLength, logUnit) / logUnit, 1.0 / 2.0);
    //const lang = textEditor.document.languageId;
    const delay = false ? //isClip(lang, textLength) ?
            30: // clipDelay.get(lang):
            logRate *
            (
                10 + //basicDelay.get(lang) +
                (
                    undefined === documentDecorationCache.get(textEditor.document) ?
                        50: // additionalDelay.get(lang):
                        0
                )
            );
    //console.log(`document: ${textEditor.document.fileName}, textLength: ${textLength}, logRate: ${logRate}, delay: ${delay}`);
    setTimeout
    (
        () =>
        {
            if (lastUpdateStamp.get(textEditor) === updateStamp)
            {
                lastUpdateStamp.delete(textEditor);
                updateDecoration(textEditor);
            }
        },
        delay
    );
};
export const updateAllDecoration = () =>
    vscode.window.visibleTextEditors.forEach(i => delayUpdateDecoration(i));
export const onDidChangeWorkspaceFolders = onDidChangeConfiguration;
export const onDidChangeActiveTextEditor = (): void =>
{
    clearDecorationCache();
    activeTextEditor(delayUpdateDecoration);
};
export const onDidCloseTextDocument = clearDecorationCache;
export const onDidChangeTextDocument = (document: vscode.TextDocument): void =>
{
    clearDecorationCache(document);
    vscode.window.visibleTextEditors
        .filter(i => i.document === document)
        .forEach(i => delayUpdateDecoration(i));
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
                    onDidChangeConfiguration();
                }
            }
        ),
        vscode.workspace.onDidChangeWorkspaceFolders(() => onDidChangeWorkspaceFolders()),
        vscode.workspace.onDidChangeTextDocument(event => onDidChangeTextDocument(event.document)),
        vscode.workspace.onDidCloseTextDocument((document) => onDidCloseTextDocument(document)),
        vscode.window.onDidChangeActiveTextEditor(() => onDidChangeActiveTextEditor()),
        //vscode.window.onDidChangeTextEditorSelection(() => onDidChangeTextEditorSelection()),
        //vscode.window.onDidChangeTextEditorVisibleRanges(() => onDidChangeTextEditorVisibleRanges()),
        //vscode.window.onDidChangeActiveColorTheme(() => onDidChangeActiveColorTheme());
        //vscode.window.onDidChangeVisibleTextEditors(textEditers => onDidChangeVisibleTextEditors(textEditers)),
    );
};
export const deactivate = () => {};
