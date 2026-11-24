# Nand2Tetris 院ゼミ後半用リポジトリ

基本ゲートから Hack Computer までを HDL で組み立て、自分で書いた Hack アセンブリを動かす。加算回路は、機能をテストで確認した上で NAND 数と最大論理段数を比較する。

[ゼミ資料（esa）](https://vdslab.esa.io/posts/9134) · [Nand2Tetris 公式教材](https://www.nand2tetris.org/course)

## セットアップ

Node.js 24.16.0 と npm 10 以上を用意し、リポジトリのルートで一度実行する。Windows では WSL などのシェルを使う。

```sh
./check setup
```

Java、ブラウザの起動、グローバルインストールは不要。依存関係を取得する初回は npm レジストリへの接続が必要。

## 授業回と検証コマンド

| 回 | 作業フォルダ | 実装課題 | 一括検証 |
| --- | --- | --- | --- |
| 1 | [`seminar/hardware/lesson-1/`](seminar/hardware/lesson-1) | Not、And、Or、Xor、Mux、DMux、Not16、And16、Or16、Mux16、Or8Way、Mux4Way16、Mux8Way16、DMux4Way、DMux8Way | `./check lesson 1` |
| 2 | [`seminar/hardware/lesson-2/`](seminar/hardware/lesson-2) | HalfAdder、FullAdder、Add16、Inc16、ALU | `./check lesson 2` |
| 3 | [`seminar/hardware/lesson-3/`](seminar/hardware/lesson-3) | Bit、Register、PC、RAM8、RAM64、RAM512、RAM4K、RAM16K | `./check lesson 3` |
| 4 | [`seminar/programs/lesson-4/`](seminar/programs/lesson-4) | `Mult.asm`、`Fill.asm`（動作確認用の `Add.asm` も同梱） | `./check lesson 4` |
| 5 | [`seminar/hardware/lesson-5/`](seminar/hardware/lesson-5) | CPU | `./check lesson 5` |
| 6 | [`seminar/hardware/lesson-6/`](seminar/hardware/lesson-6) | Memory、Computer | `./check lesson 6` |

Web IDE の Project 1〜5 にある実装課題のスターターを収録している。Nand、DFF、ROM32K、Screen、Keyboard、ARegister、DRegister は組み込み部品を利用できる。 第6回の公式 Computer テストは RAM の番地を直接参照するため、この回には組み込み RAM16K を指定する Web IDE の HDL も同梱している。第3回の `RAM16K.hdl` が実装課題。

一括検証の既定は HDL の単体検証。第6回の `Memory` は単体で確認し、`Computer` は第4回の `Add.asm` を使って統合検証する。第4回の `Fill` は `FillAutomatic.tst`・`FillAutomatic.cmp` で自動検証する。各回の検証対象と HDL の短い名前の割り当ては [`seminar/lessons.mjs`](seminar/lessons.mjs) の `checks` で管理する。

公式の `Memory.tst` が要求するキー入力は `./check` が注入する。キーボードの出力が正しく接続されていない場合は、入力待ちを打ち切って失敗を報告する。

### 単体検証と統合検証

```sh
./check ALU --isolated       # ALU.hdl を読み、依存部品に組み込み実装を使う
./check ALU --integrated     # 自作依存部品を優先し、読み込み元を表示
./check lesson 2 --isolated
./check lesson 2 --integrated
./check computer Add --isolated
./check computer Add --integrated
```

- 単体検証では対象の HDL を読み、依存部品には組み込み実装を使う。同じフォルダの未完成 HDL があっても対象だけを確認できる。組み込み実装がない自作依存部品が必要なときは統合検証を使う。
- 統合検証では、対象と同じフォルダを最初に探し、ゼミの HDL なら前の授業回のフォルダも新しい回から順に探す。例えば第6回の `Computer.hdl` は第5回の `CPU.hdl` を利用できる。ファイルが見つからない部品は、組み込み実装があればそちらを使う。存在する未完成の HDL も読み込むため、依存部品が原因でテストが失敗することがある。出力の `DEP` 行は、ローカル HDL の参照先ごとに `LOCAL (パス)`、`BUILTIN (fallback)`、`BUILTIN (パス)`（ファイル内の明示指定）、`MISSING`、または読み込みエラーを示す。
- フラグなしの個別 HDL 検証と `./check computer Add` は従来どおり自作の依存部品を優先する。第4回は常に CPU エミュレータで ASM を実行する。

### 結果の読み方

- `PASS` は期待出力との一致、`FAIL` は出力不一致や解析・実行エラー。出力不一致では最初にずれた行・列と期待値・実際の値を表示する。
- 一括検証の `SKIP` は必要なソース、`.tst`、`.cmp` の欠落。理由とファイル名を表示し、後続のテストも実行する。
- 一括検証の末尾には `Passed`、`Failed`、`Skipped` と `Result` を表示する。全件合格で終了コード `0`、`FAIL` または `SKIP` があれば `1`。配布直後の未実装 HDL は失敗する。

### ファイルの指定と ASM の変換

名前だけで指定すると、HDL は対応する授業回のフォルダ、ASM は `seminar/programs/lesson-4/` を参照する。HDL と CPU エミュレータの検証では、既定でソースと同名の `.tst`・`.cmp` を使う。別名の場合はテストと期待値のパスを両方指定する。第5回で `DRegister` を使わない実装には、公式の代替テスト `CPU-external` がある。

```sh
./check RAM16K --isolated
./check cpu Mult
./check cpu Fill
./check CPU seminar/hardware/lesson-5/CPU-external.tst seminar/hardware/lesson-5/CPU-external.cmp --isolated
./check cpu path/to/source.asm path/to/source.tst path/to/expected.cmp
./check assemble Add  # seminar/programs/lesson-4/Add.hack を生成
./check computer path/to/source.asm path/to/Computer.hdl path/to/test.tst path/to/expected.cmp
```

`./check computer Foo` は `seminar/programs/lesson-4/Foo.asm` と `seminar/hardware/lesson-6/` 内の `Computer.hdl`、`ComputerFoo.tst`、`ComputerFoo.cmp` を使う。テストには `ROM32K load Foo.hack` を指定する。変換した機械語は直接 ROM に渡すので、既存の `.hack` は上書きされない。CPU エミュレータ用テストでクロックを進める命令は `ticktock`。

第6回には公式の `Max.hack` と `Rect.hack` も同梱している。対応する Computer テストで追加検証できる。

```sh
./check Computer seminar/hardware/lesson-6/ComputerMax.tst seminar/hardware/lesson-6/ComputerMax.cmp --integrated
./check Computer seminar/hardware/lesson-6/ComputerRect.tst seminar/hardware/lesson-6/ComputerRect.cmp --integrated
```

### Codex・Claude Code での利用例

> `ALU.hdl` の入出力仕様と公式テストを確認し、`./check ALU --isolated` を実行して。失敗したら最初の不一致を説明し、必要な修正は `ALU.hdl` に限定して。次に `./check lesson 2 --integrated` で、結果の集計と組み込み部品にフォールバックした箇所を報告して。

## ツール自体の動作確認

`./check verify` は教材とシミュレータをビルドし、一時ファイルのサンプルで HDL・ASM・Computer と一括検証の動作を確認する。参加者の実装が未完成でも実行できる。`./check --help` でコマンド一覧を表示する。

NAND数・最大論理段数の計測器は別途用意する。

このリポジトリは [nand2tetris/web-ide](https://github.com/nand2tetris/web-ide) をベースにしている。元の説明は [UPSTREAM.md](UPSTREAM.md)、開発手順は [DEVELOPMENT.md](DEVELOPMENT.md) を参照。
