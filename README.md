# @tp-lab/web3-react

TokenPocket Wallet connector for [web3-react](https://www.npmjs.com/package/web3-react)

# Usage

```
import { initializeConnector } from '@web3-react/core'
import { TokenPocketWallet } from "@tp-lab/web3-react";

  const [tokenpocket, hooks] = initializeConnector<TokenPocketWallet>(
    (actions) => new TokenPocketWallet({ actions })
  );
    
  tokenpocket.activate();
```
