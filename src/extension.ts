import * as vscode from "vscode";
import { ContractTreeDataProvider, Contract } from "./ContractTreeDataProvider";
import { AbiTreeDataProvider, Abi } from "./AbiTreeDataProvider";
import { AccountTreeDataProvider, Account } from "./AccountTreeDataProvider";
import { STATE } from "./state";
import { callMethod, sendTransaction } from "./eth";

function printResponse(channel: vscode.OutputChannel, result: any) {
  channel.appendLine(
    JSON.stringify(
      result,
      function (k, v) {
        if (v instanceof Array) {
          return JSON.stringify(v);
        }
        return v;
      },
      2
    )
      .replace(/\\/g, "")
      .replace(/\"\[/g, "[")
      .replace(/\]\"/g, "]")
      .replace(/\"\{/g, "{")
      .replace(/\}\"/g, "}")
  );
}

export function activate(context: vscode.ExtensionContext) {
  const contractTreeDataProvider = new ContractTreeDataProvider(
    vscode.workspace.rootPath
  );
  const contractTreeView = vscode.window.createTreeView(
    "eth-abi-explorer.contracts",
    {
      treeDataProvider: contractTreeDataProvider,
    }
  );
  context.subscriptions.push(contractTreeView);

  const abiTreeDataProvider = new AbiTreeDataProvider(
    vscode.workspace.rootPath
  );
  const abiTreeView = vscode.window.createTreeView("eth-abi-explorer.abis", {
    treeDataProvider: abiTreeDataProvider,
  });
  abiTreeView.message =
    "Select a contract and its ABI functions will appear here.";
  context.subscriptions.push(abiTreeView);

  const accountTreeDataProvider = new AccountTreeDataProvider(
    vscode.workspace.rootPath
  );
  const accountTreeView = vscode.window.createTreeView(
    "eth-abi-explorer.accounts",
    {
      treeDataProvider: accountTreeDataProvider,
    }
  );
  accountTreeView.description = "Using random auto generated account";
  context.subscriptions.push(accountTreeView);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.setEndpoint",
      async () => {
        const value = await vscode.window.showInputBox({
          prompt: `Ethereun node endpoint URI`,
          value: STATE.endpoint,
        });
        if (value) {
          STATE.endpoint = value;
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.addPrivateKey",
      async () => {
        const key = await vscode.window.showInputBox({
          prompt: `Private key of new account`,
          password: true,
        });
        if (key) {
          try {
            const acc = STATE.web3.eth.accounts.privateKeyToAccount(key);
            // Should have failed if invalid private key
            let alias = await vscode.window.showInputBox({
              prompt: `Alias to identify this account`,
              value: `Address ${acc.address}`,
            });
            if (!alias) {
              alias = `Address ${acc.address}`;
            }
            await STATE.addAccount(alias, acc);
            STATE.account = acc;
            // refresh private keys tree
            accountTreeDataProvider.refresh();
          } catch (err) {
            vscode.window.showErrorMessage(`Error: ${(err as Error).message}`);
          }
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("eth-abi-explorer.refreshEntry", () =>
      contractTreeDataProvider.refresh()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("eth-abi-explorer.refreshAccounts", () =>
      accountTreeDataProvider.refresh()
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.useContract",
      async (node: Contract) => {
        const address = await vscode.window.showInputBox({
          prompt: `Deployed contract address`,
        });
        if (!address) {
          return;
        }
        STATE.currentContract = node.label;
        STATE.contractAddress = address;
        abiTreeDataProvider.refresh();
        abiTreeView.description = `${node.label} @ ${address}`;
        abiTreeView.message = undefined;
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.useAccount",
      async (node: Account) => {
        const password = await vscode.window.showInputBox({
          prompt: `Password to decrypt ${node.key.alias}`,
          password: true,
        });
        if (password) {
          STATE.account = await STATE.web3.eth.accounts.decrypt(
            node.key.account,
            password
          );
          accountTreeView.description = `Using ${node.key.alias}`;
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.editInput",
      async (input: Abi) => {
        const value = await vscode.window.showInputBox({
          prompt: `${input.abi.name}: ${input.abi.type}`,
        });
        input.value = value;
        input.description = `${input.abi.type}: ${value}`;
        abiTreeDataProvider.refresh(input);
      }
    )
  );

  const channel = vscode.window.createOutputChannel("Eth ABI Explorer");
  context.subscriptions.push(channel);

  function getParams(func: Abi) {
    const params = [];
    const paramsDesc = [];
    for (const input of func.children) {
      paramsDesc.push(`${input.abi.type} ${input.abi.name} = ${input.value}`);
      if (input.abi.type === "bool") {
        params.push(JSON.parse(input.value));
      } else {
        params.push(input.value);
      }
    }
    return { params, paramsDesc };
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.sendTransaction",
      async (func: Abi) => {
        const { params, paramsDesc } = getParams(func);
        channel.appendLine(
          "####################################################################################"
        );
        channel.appendLine(
          `Sending transaction ${func.abi.name}(${paramsDesc.join(", ")}) ...`
        );
        channel.show(true);
        try {
          const receipt = await sendTransaction(func.abi.name, ...params);
          printResponse(channel, receipt);
        } catch (error) {
          channel.appendLine(`ERROR ${(error as Error).message}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "eth-abi-explorer.callMethod",
      async (func: Abi) => {
        const { params, paramsDesc } = getParams(func);
        channel.appendLine(
          "####################################################################################"
        );
        channel.appendLine(
          `Calling method ${func.abi.name}(${paramsDesc.join(", ")}) ...`
        );
        channel.show(true);
        try {
          const result = await callMethod(func.abi.name, ...params);
          printResponse(channel, result);
        } catch (error) {
          channel.appendLine(`ERROR ${(error as Error).message}`);
        }
      }
    )
  );
}

export function deactivate() {}
