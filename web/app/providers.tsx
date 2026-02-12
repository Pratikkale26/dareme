'use client';

import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { useEffect } from 'react';
import { api } from '../lib/api';

const solanaConnectors = toSolanaWalletConnectors();

/** Inner component that wires the Privy auth token to the API client */
function ApiTokenSync({ children }: { children: React.ReactNode }) {
    const { getAccessToken } = usePrivy();

    useEffect(() => {
        api.setTokenGetter(getAccessToken);
    }, [getAccessToken]);

    return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <PrivyProvider
            appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
            config={{
                // Login methods configuration
                loginMethods: ['twitter', 'google', 'wallet'],

                // Appearance
                appearance: {
                    theme: 'dark',
                    accentColor: '#FF6B35',
                    logo: '/logo.svg',
                    walletChainType: 'solana-only',
                    landingHeader: 'Welcome to DareMe 🔥',
                    loginMessage: 'Put your money where your mouth is.',
                },

                // Embedded wallets — auto-create Solana wallet for social login users
                embeddedWallets: {
                    solana: {
                        createOnLogin: 'users-without-wallets',
                    },
                },

                // External wallet connectors (Phantom, Backpack, etc.)
                externalWallets: {
                    solana: {
                        connectors: solanaConnectors,
                    },
                },
            }}
        >
            <ApiTokenSync>{children}</ApiTokenSync>
        </PrivyProvider>
    );
}
