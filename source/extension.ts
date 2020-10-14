import * as vscode from 'vscode';
import * as vscel from '@wraith13/vscel';
import packageJson from "../package.json";
import localeEn from "../package.nls.json";
import localeJa from "../package.nls.ja.json";
const locale = vscel.locale.make(localeEn, { "ja": localeJa });
const profile = vscel.profiler.profile;
module Config
{
    const modeObject = Object.freeze({ "none": "none", "smart": "smart", "full": "full", });
    export const root = vscel.config.makeRoot(packageJson);
    export const mode = root.makeMapEntry("bracketLens.mode", modeObject);
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
interface BracketContext
{
    parentEntry: BracketEntry | undefined;
    previousEntry: BracketEntry | undefined;
    entry: BracketEntry;
    nextEntry: BracketEntry | undefined;
}
interface BracketDecorationSource
{
    range: vscode.Range;
    bracketHeader: string;
}


class DocumentDecorationCacheEntry
{
    brackets: BracketEntry[];
    decorationSource: BracketDecorationSource[] = [];
    public constructor(document: vscode.TextDocument)
    {
        this.brackets = parseBrackets(document);
        this.decorationSource = getBracketDecorationSource(document, this.brackets);
    }
}
// class EditorDecorationCacheEntry
// {
//     public constructor()
//     {
//     }
// }
const documentDecorationCache = new Map<vscode.TextDocument, DocumentDecorationCacheEntry>();
// const editorDecorationCache = new Map<vscode.TextEditor, EditorDecorationCacheEntry>();
const makeSuredocumentDecorationCache = (document: vscode.TextDocument) =>
    documentDecorationCache.get(document) ?? new DocumentDecorationCacheEntry(document);
const parseBrackets = (document: vscode.TextDocument) => profile
(
    "parseBrackets",
    (): BracketEntry[] =>
    {
        const result:BracketEntry[] = [];

        return result;
    }
);
const getBracketHeader =
(
    document: vscode.TextDocument,
    context: BracketContext
) => profile
(
    "getBracketHeader",
    (): string =>
    {
        const lineHead = new vscode.Position(context.entry.start.line, 0);
        let result = document.getText(new vscode.Range(lineHead, context.entry.start)).trim();
        if (result.length <= 0 && 0 < context.entry.start.line)
        {
            const previousLineHead = new vscode.Position(context.entry.start.line -1, 0);
            result = document.getText(new vscode.Range(previousLineHead, lineHead)).trim();
        }
        return result;
    }
);
export const getBracketDecorationSource = (document: vscode.TextDocument, brackets: BracketEntry[]) => profile
(
    "getBracketDecorationSource",
    () =>
    {
        const result: BracketDecorationSource[] = [];
        const scanner = (context: BracketContext) =>
        {
            if (context.entry.start.line < context.entry.end.line)
            {
                const bracketHeader = getBracketHeader(document, context);
                if (0 < bracketHeader.length)
                {
                    result.push
                    ({
                        range: new vscode.Range
                        (
                            new vscode.Position(context.entry.end.line, context.entry.end.character -1),
                            context.entry.end
                        ),
                        bracketHeader,
                    });
                }
                context.entry.items.map
                (
                    (entry, index, array) => scanner
                    ({
                        parentEntry: context.entry,
                        previousEntry:array[index -1],
                        entry,
                        nextEntry:array[index +1],
                    })
                );
            }
        };
        brackets.map
        (
            (entry, index, array) => scanner
            ({
                parentEntry:undefined,
                previousEntry:array[index -1],
                entry,
                nextEntry:array[index +1],
            })
        );

        //  ここで刈り込み

        return result;
    }
);
export const updateDecoration = (textEditor: vscode.TextEditor) => profile
(
    "updateDecoration",
    () =>
    {
        const bracketHeaderInformationDecoration = vscode.window.createTextEditorDecorationType
        ({
            isWholeLine: true,
            //color,
        });
        const options: vscode.DecorationOptions[] = [];
        if ("none" !== Config.mode.get(textEditor.document.languageId))
        {
            const color = Config.color.get(textEditor.document.languageId);
            const prefix = Config.prefix.get(textEditor.document.languageId);
            const documentDecorationCache = makeSuredocumentDecorationCache(textEditor.document);
            documentDecorationCache.decorationSource.forEach
            (
                i => options.push
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
        }
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
        // for(const textEditor of editorDecorationCache.keys())
        // {
        //     if (document === textEditor.document)
        //     {
        //         editorDecorationCache.delete(textEditor);
        //     }
        // }
    }
    else
    {
        // for(const textEditor of editorDecorationCache.keys())
        // {
        //     if (vscode.window.visibleTextEditors.indexOf(textEditor) < 0)
        //     {
        //         editorDecorationCache.delete(textEditor);
        //     }
        // }
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
