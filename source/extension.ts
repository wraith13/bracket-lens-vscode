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
interface TokenEntry
{
    position: vscode.Position;
    token: string;
}
interface BracketEntry
{
    start: TokenEntry;
    end: TokenEntry;
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
        documentDecorationCache.set(document, this);
    }
}
class EditorDecorationCacheEntry
{
    public bracketHeaderInformationDecoration?: vscode.TextEditorDecorationType;
    public constructor(editor: vscode.TextEditor)
    {
        editorDecorationCache.set(editor, this);
    }
    public dispose = () =>
    {
        this.bracketHeaderInformationDecoration?.dispose();
        this.bracketHeaderInformationDecoration = undefined;
    };
}
const documentDecorationCache = new Map<vscode.TextDocument, DocumentDecorationCacheEntry>();
const makeSureDocumentDecorationCache = (document: vscode.TextDocument) =>
    documentDecorationCache.get(document) ?? new DocumentDecorationCacheEntry(document);
const editorDecorationCache = new Map<vscode.TextEditor, EditorDecorationCacheEntry>();
const makeSureEditorDecorationCache = (textEditor: vscode.TextEditor) =>
    editorDecorationCache.get(textEditor) ?? new EditorDecorationCacheEntry(textEditor);
export const regExpExecToArray = (regexp: RegExp, text: string) => profile
(
    `regExpExecToArray(/${regexp.source}/${regexp.flags})`,
    () =>
    {
        const result: RegExpExecArray[] = [];
        while(true)
        {
            const match = regexp.exec(text);
            if (null === match)
            {
                break;
            }
            result.push(match);
        }
        return result;
    }
);
const makeRegExpPart = (text: string) => text.replace(/([\\\/\*\[\]\(\)\{\}\|])/gmu, "\\$1");
const isInlineScope = (bracket: BracketEntry) => bracket.end.position.line <= bracket.start.position.line;
const parseBrackets = (document: vscode.TextDocument) => profile
(
    "parseBrackets",
    (): BracketEntry[] =>
    {
        const result:BracketEntry[] = [];
        const languageConfiguration =
        {
            "comments": {
                "blockComment": [
                    "/*",
                    "*/"
                ],
                "lineComment": "//"
            },
            "brackets": [
                [
                    "(",
                    ")"
                ],
                [
                    "[",
                    "]"
                ],
                [
                    "{",
                    "}"
                ]
            ],
            "strings": [
                "\"",
                "\`",
                "\'",
            ],
            "stringEscapes": [
                "\\\"",
                "\\\`",
                "\\\'",
            ]
        };
        const text = document.getText();
        const pattern = (<string[]>[])
            .concat(languageConfiguration.comments.blockComment)
            .concat(languageConfiguration.comments.lineComment)
            .concat(languageConfiguration.brackets.reduce((a, b) => a.concat(b), []))
            .concat(languageConfiguration.stringEscapes)
            .concat(languageConfiguration.strings)
            //.concat("\\n")
            .map(i => `${makeRegExpPart(i)}`)
            .join("|");
        const tokens = regExpExecToArray
        (
            new RegExp(pattern, "gu"),
            text
        )
        .map
        (
            match =>
            ({
                index: match.index,
                token: match[0],
            })
        );
        //type CodeState = "neutral" | "block-comment" | "line-comment" | "string";
        //let state: CodeState = "neutral";
        let scopeStack: { start: TokenEntry, items: BracketEntry[] }[] = [];
        let i = 0;
        profile
        (
            "parseBrackets.scan",
            () =>
            {
                while(i < tokens.length)
                {
                    //const t = tokens[i];
                    if (languageConfiguration.comments.blockComment[0] === tokens[i].token)
                    {
                        profile
                        (
                            "parseBrackets.scan.blockComment",
                            () =>
                            {
                                while(++i < tokens.length)
                                {
                                    if (languageConfiguration.comments.blockComment[1] === tokens[i].token)
                                    {
                                        ++i;
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    if (languageConfiguration.comments.lineComment === tokens[i].token)
                    {
                        profile
                        (
                            "parseBrackets.scan.lineComment",
                            () =>
                            {
                                const line = document.positionAt(tokens[i].index).line;
                                while(++i < tokens.length)
                                {
                                    if (line !== document.positionAt(tokens[i].index).line)
                                    {
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    if (0 <= languageConfiguration.brackets.map(j => j[0]).indexOf(tokens[i].token))
                    {
                        profile
                        (
                            "parseBrackets.scan.openingBracket",
                            () =>
                            {
                                scopeStack.push
                                ({
                                    start:
                                    {
                                        position: document.positionAt(tokens[i].index),
                                        token: tokens[i].token,
                                    },
                                    items: [],
                                });
                                ++i;
                            }
                        );
                    }
                    else
                    if (0 <= languageConfiguration.brackets.map(j => j[1]).indexOf(tokens[i].token))
                    {
                        profile
                        (
                            "parseBrackets.scan.closingBracket",
                            () =>
                            {
                                const scope = scopeStack.pop();
                                if (scope)
                                {
                                    const current =
                                    {
                                        start: scope.start,
                                        end:
                                        {
                                            position: document.positionAt(tokens[i].index +tokens[i].token.length),
                                            token: tokens[i].token,
                                        },
                                        items: scope.items,
                                    };
                                    if ( ! isInlineScope(current))
                                    {
                                        const parent = scopeStack[scopeStack.length -1];
                                        if (parent)
                                        {
                                            parent.items.push(current);
                                        }
                                        else
                                        {
                                            result.push(current);
                                        }
                                    }
                                }
                                ++i;
                            }
                        );
                    }
                    else
                    if (0 <= languageConfiguration.strings.indexOf(tokens[i].token))
                    {
                        profile
                        (
                            "parseBrackets.scan.string",
                            () =>
                            {
                                const line = document.positionAt(tokens[i].index).line;
                                const start = tokens[i].token;
                                while(++i < tokens.length)
                                {
                                    if (line !== document.positionAt(tokens[i].index).line)
                                    {
                                        break;
                                    }
                                    if ("\n" === tokens[i].token || start === tokens[i].token)
                                    {
                                        ++i;
                                        break;
                                    }
                                }
                            }
                        );
                    }
                    else
                    {
                        ++i;
                    }
                };
                profile
                (
                    "parseBrackets.scan.rest",
                    () =>
                    {
                        while(0 < scopeStack.length)
                        {
                            const scope = scopeStack.pop();
                            if (scope)
                            {
                                const current =
                                {
                                    start: scope.start,
                                    end:
                                    {
                                        position: document.positionAt(text.length),
                                        token:"",
                                    },
                                    items: scope.items,
                                };
                                if ( ! isInlineScope(current))
                                {
                                    const parent = scopeStack[scopeStack.length -1];
                                    if (parent)
                                    {
                                        parent.items.push(current);
                                    }
                                    else
                                    {
                                        result.push(current);
                                    }
                                }
                            }
                            else
                            {
                                break;
                            }
                        }
                    }
                );
            }
        );
        return result;
    }
);
module position
{
    export const nextLine = (position: vscode.Position, increment: number = 1) => new vscode.Position
        (
            position.line +increment,
            0
        );
    export const nextCharacter = (position: vscode.Position, increment: number = 1) => new vscode.Position
        (
            position.line,
            position.character +increment
        );
    export const min = (positions: vscode.Position[]) =>
        positions.reduce((a, b) => a.isBefore(b) ? a: b, positions[0]);
    export const max = (positions: vscode.Position[]) =>
        positions.reduce((a, b) => a.isAfter(b) ? a: b, positions[0]);
}
const getBracketHeader =
(
    document: vscode.TextDocument,
    context: BracketContext
) => profile
(
    "getBracketHeader",
    (): string =>
    {
        const regulateHeader = (text: string) => text.replace(/\s+/gu, " ").trim();
        const isValidHeader = (text: string) => 0 < text
            //.replace(/\W/gmu, "")
            .replace(/,/gmu, "")
            .trim().length;
        const topLimit =
            context.previousEntry?.end.position ??
            (
                undefined !== context.parentEntry ?
                    position.nextCharacter
                    (
                        context.parentEntry.start.position,
                        context.parentEntry.start.token.length
                    ):
                    new vscode.Position(0, 0)
            );
        const lineHead = position.max
        ([
            topLimit,
            position.nextLine(context.entry.start.position, 0),
        ]);
        const currnetLineHeader = regulateHeader(document.getText(new vscode.Range(lineHead, context.entry.start.position)));
        if (isValidHeader(currnetLineHeader))
        {
            return currnetLineHeader;
        }
        if (topLimit.line < context.entry.start.position.line)
        {
            const previousLineHead = position.max
            ([
                topLimit,
                position.nextLine(context.entry.start.position, -1),
            ]);
            const previousLineHeader = regulateHeader(document.getText(new vscode.Range(previousLineHead, lineHead)));
            if (isValidHeader(previousLineHeader))
            {
                return previousLineHeader;
            }
        }
        const currnetLineInnerHeader = regulateHeader
        (
            document.getText
            (
                new vscode.Range
                (
                    position.nextCharacter
                    (
                        context.entry.start.position,
                        context.entry.start.token.length
                    ),
                    position.nextLine(context.entry.start.position, +1)
                )
            )
        );
        if (isValidHeader(currnetLineInnerHeader))
        {
            return currnetLineInnerHeader;
        }
        const innerHeader = regulateHeader
        (
            document.getText
            (
                new vscode.Range
                (
                    context.entry.start.position,
                    position.min
                    ([
                        position.nextLine(context.entry.start.position, +16),
                        context.entry.end.position,
                    ])
                )
            )
        );
        if (isValidHeader(innerHeader))
        {
            const maxHeaderLength = 80;
            if (innerHeader.length <= maxHeaderLength)
            {
                return innerHeader;
            }
            else
            {
                return innerHeader.substring(0, maxHeaderLength) +"...";
            }
        }
        return "";
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
            if
            (
                // １行に収まる場合はスキップ
                context.entry.start.position.line < context.entry.end.position.line &&
                // 後続ブロックが閉じと同じ行で始まる場合はスキップ
                context.entry.end.position.line < (context.nextEntry?.start.position.line ?? document.lineCount +1) &&
                // 親の閉じと同じ行になる場合は親を優先
                context.entry.end.position.line < (context.parentEntry?.end.position.line ?? document.lineCount +1)
            )
            {
                const bracketHeader = getBracketHeader(document, context);
                if (0 < bracketHeader.length)
                {
                    result.push
                    ({
                        range: new vscode.Range
                        (
                            position.nextCharacter(context.entry.end.position, -context.entry.end.token.length),
                            context.entry.end.position
                        ),
                        bracketHeader,
                    });
                }
                context.entry.items.map
                (
                    (entry, index, array) => scanner
                    ({
                        parentEntry: context.entry,
                        previousEntry: array[index -1],
                        entry,
                        nextEntry: array[index +1],
                    })
                );
            }
        };
        brackets.map
        (
            (entry, index, array) => scanner
            ({
                parentEntry: undefined,
                previousEntry: array[index -1],
                entry,
                nextEntry: array[index +1],
            })
        );
        return result;
    }
);
export const updateDecoration = (textEditor: vscode.TextEditor) => profile
(
    "updateDecoration",
    () =>
    {
        if ("none" !== Config.mode.get(textEditor.document.languageId))
        {
            if ( ! editorDecorationCache.get(textEditor))
            {
                const bracketHeaderInformationDecoration = vscode.window.createTextEditorDecorationType
                ({
                    isWholeLine: true,
                    //color,
                });
                const options: vscode.DecorationOptions[] = [];
                const color = Config.color.get(textEditor.document.languageId);
                const prefix = Config.prefix.get(textEditor.document.languageId);
                makeSureDocumentDecorationCache(textEditor.document).decorationSource.forEach
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
                makeSureEditorDecorationCache(textEditor).bracketHeaderInformationDecoration = bracketHeaderInformationDecoration;
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
        }
        else
        {
            editorDecorationCache.get(textEditor)?.dispose();
        }
    }
);
export const onDidChangeConfiguration = () =>
{
    Config.root.entries.forEach(i => i.clear());
    updateAllDecoration();
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
        for(const textEditor of editorDecorationCache.keys())
        {
            if (document === textEditor.document)
            {
                editorDecorationCache.get(textEditor)?.dispose();
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
                editorDecorationCache.get(textEditor)?.dispose();
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
                100 + //basicDelay.get(lang) +
                (
                    undefined === documentDecorationCache.get(textEditor.document) ?
                        500: // additionalDelay.get(lang):
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
    updateAllDecoration();
};
export const deactivate = () => {};
