import {
  Actions,
  AddEthereumChainParameter,
  Provider,
  ProviderConnectInfo,
  ProviderRpcError,
  WatchAssetParameters,
  Connector
} from '@web3-react/types'

type TokenPocketProvider = Provider & {
  isTokenPocket?: boolean
  isConnected?: () => boolean
}

function parseChainId(chainId: string) {
  return Number.parseInt(chainId, 16)
}

export interface TokenPocketConstructorArgs {
  actions: Actions
  onError?: () => void
}

type TokenPocketWindow = typeof Window & {
  ethereum?: TokenPocketProvider;
  tokenpocket?: {
    ethereum?: TokenPocketProvider
  }
}

export class TokenPocketWallet extends Connector {
  public provider?: TokenPocketProvider

  constructor({ actions, onError }: TokenPocketConstructorArgs) {
    super(actions, onError)
  }

  private detectProvider(): TokenPocketProvider | void {
    this.provider = ((window as unknown as TokenPocketWindow).tokenpocket)?.ethereum;

    if (this.provider) {
      return this.provider
    }
  }

  private isomorphicInitialize(): void {
    const provider = this.detectProvider();
    if (provider) {
      provider.on('connect', ({ chainId }: ProviderConnectInfo): void => {
        this.actions.update({ chainId: parseChainId(chainId) })
      })

      provider.on('disconnect', (error: ProviderRpcError): void => {
        this.provider?.request({ method: 'PUBLIC_disconnectSite' })

        this.actions.resetState()
        this.onError?.(error)
      })

      provider.on('chainChanged', (chainId: string): void => {
        this.actions.update({ chainId: Number(chainId) })
      })

      provider.on('accountsChanged', (accounts: string[]): void => {
        if (accounts.length === 0) {
          this.actions.resetState()
        } else {
          this.actions.update({ accounts })
        }
      })
    }
  }

  public async connectEagerly(): Promise<void> {
    const cancelActivation = this.actions.startActivation()

    try {
      this.isomorphicInitialize()
      if (!this.provider) return cancelActivation()
      const accounts = (await this.provider.request({ method: 'eth_accounts' })) as string[]
      if (!accounts.length) throw new Error('No accounts returned')
      const chainId = (await this.provider.request({ method: 'eth_chainId' })) as string
      this.actions.update({ chainId: parseChainId(chainId), accounts })
    } catch (error) {
      this.actions.resetState()
    }
  }

  public async activate(desiredChainIdOrChainParameters?: number | AddEthereumChainParameter): Promise<void> {
    this.detectProvider();

    if (!this.provider) {
      (window as unknown as Window)?.open('https://tokenpocket.pro/', '_blank')
      return
    }

    const accounts = (await this.provider.request({ method: 'eth_requestAccounts' })) as string[]
    const chainId = (await this.provider.request({ method: 'eth_chainId' })) as string
    const receivedChainId = parseChainId(chainId)
    const desiredChainId =
      typeof desiredChainIdOrChainParameters === 'number'
        ? desiredChainIdOrChainParameters
        : desiredChainIdOrChainParameters?.chainId

    if (!desiredChainId || receivedChainId === desiredChainId)
      return this.actions.update({ chainId: receivedChainId, accounts })

    const desiredChainIdHex = `0x${desiredChainId.toString(16)}`

    // if we're here, we can try to switch networks
    return this.provider
      .request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: desiredChainIdHex }],
      })
      .catch((error: ProviderRpcError) => {
        const errorCode = (error.data as any)?.originalError?.code || error.code

        if (errorCode === 4902 && typeof desiredChainIdOrChainParameters !== 'number') {
          if (!this.provider) throw new Error('No provider')
          // if we're here, we can try to add a new network
          return this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [{ ...desiredChainIdOrChainParameters, chainId: desiredChainIdHex }],
          })
        }

        throw error
      })
      .then(() => this.activate(desiredChainId))

  }

  public async watchAsset({ address, symbol, decimals, image }: WatchAssetParameters): Promise<true> {
    if (!this.provider) throw new Error('No provider')

    return this.provider
      .request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address,
            symbol,
            decimals,
            image,
          },
        },
      })
      .then((success) => {
        if (!success) throw new Error('Rejected')
        return true
      })
  }
}
