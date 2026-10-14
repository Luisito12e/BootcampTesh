'use client';

import { useState } from 'react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';

const CONTRACT_ID = 'CDJOAL324VZSC53P2TY5GHSZBMCS2NAWS6CM3Z7HXKK4ZETGOBSZ3ENA';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = StellarSdk.Networks.TESTNET;

export default function Home() {
  const [wallet, setWallet] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [txLink, setTxLink] = useState<string>('');

  const connectWallet = async () => {
    try {
      const connected = await isConnected();
      if (!connected) {
        alert('Por favor asegúrate de tener la extensión Freighter instalada y desbloqueada.');
        return;
      }
      const accessObj = await requestAccess();
      if (accessObj.address) {
        setWallet(accessObj.address);
      }
    } catch (e: any) {
      console.error(e);
      alert('Error al conectar Freighter: ' + e.message);
    }
  };

  const callContract = async () => {
    if (!wallet) {
      alert('Primero conecta tu wallet.');
      return;
    }

    setLoading(true);
    setStatus('Preparando e interactuando con el contrato en Testnet...');
    setTxLink('');

    try {
      const server = new StellarSdk.rpc.Server(RPC_URL);
      const account = await server.getAccount(wallet);
      const contract = new StellarSdk.Contract(CONTRACT_ID);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: PASSPHRASE,
      })
        .addOperation(
          contract.call('hello', StellarSdk.xdr.ScVal.scvString('Luis'))
        )
        .setTimeout(30)
        .build();

      const preparedTx = await server.prepareTransaction(tx);
      const signedXdr = await signTransaction(preparedTx.toXDR(), {
        networkPassphrase: PASSPHRASE,
      });

      if (!signedXdr.signedTxXdr) {
        throw new Error('La transacción no fue firmada en Freighter');
      }

      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signedXdr.signedTxXdr, PASSPHRASE);
      const sendResponse = await server.sendTransaction(txToSubmit);

      if (sendResponse.status === 'ERROR') {
        throw new Error('Fallo al enviar la transacción a la red');
      }

      setStatus('Esperando confirmación en el ledger...');

      let txResult = await server.getTransaction(sendResponse.hash);
      while (txResult.status === 'NOT_FOUND') {
        await new Promise((r) => setTimeout(r, 1000));
        txResult = await server.getTransaction(sendResponse.hash);
      }

      setStatus('¡Transacción completada con éxito!');
      setTxLink(`https://stellar.expert/explorer/testnet/tx/${sendResponse.hash}`);
    } catch (err: any) {
      console.error(err);
      setStatus('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Bootcamp TESH</h1>
          <p className="text-xs text-slate-400 mt-1">Interacción con Contrato Soroban en Testnet</p>
        </div>

        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
          <span className="text-slate-500 font-medium">Contrato:</span>
          <p className="text-slate-300 font-mono break-all mt-0.5">{CONTRACT_ID}</p>
        </div>

        {!wallet ? (
          <button
            onClick={connectWallet}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition duration-150"
          >
            Conectar Freighter Wallet
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-3 rounded-lg text-xs">
              <span className="text-emerald-400 font-medium">Wallet conectada:</span>
              <p className="text-emerald-200 font-mono break-all mt-0.5">{wallet}</p>
            </div>

            <button
              onClick={callContract}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition duration-150"
            >
              {loading ? 'Procesando en Testnet...' : 'Invocar hello("Luis")'}
            </button>
          </div>
        )}

        {status && (
          <p className="text-xs text-center text-slate-300 font-mono">{status}</p>
        )}

        {txLink && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
            <span className="text-xs text-slate-400 font-medium block">Evidencia On-Chain (Stellar Expert):</span>
            <a
              href={txLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 underline font-mono break-all hover:text-blue-300"
            >
              {txLink}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}