import * as vscode from "vscode";
import * as glob from "glob";
import * as fs from "fs";
import * as path from "path";
import { STATE } from "./state";

export class ContractTreeDataProvider
  implements vscode.TreeDataProvider<Contract>
{
  constructor(private workspaceRoot: string | undefined) {}

  getTreeItem(element: Contract): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Contract): Promise<Contract[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No Contracts in empty workspace");
      return [];
    }

    if (!element) {
      const dir = path.join(this.workspaceRoot, STATE.contractsPath);
      if (fs.existsSync(dir)) {
        // Recursively find all .json files
        const files = glob.sync("**/*.json", { cwd: dir });
        const leaves = files.map(
          (file) => new Contract(file, vscode.TreeItemCollapsibleState.None)
        );
        return leaves;
      }
    }

    return [];
  }

  private _onDidChangeTreeData: vscode.EventEmitter<Contract | undefined> =
    new vscode.EventEmitter<Contract | undefined>();
  readonly onDidChangeTreeData: vscode.Event<Contract | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

export class Contract extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.contextValue = "contract";
  }

  command = {
    title: "Use Contract",
    command: "eth-abi-explorer.useContract",
    arguments: [this],
  };

  iconPath = new vscode.ThemeIcon("file-code");
}
