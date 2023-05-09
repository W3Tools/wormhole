// contracts/Bridge.sol
// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import "./RelayProviderGovernance.sol";
import "./RelayProviderStructs.sol";
import "../../interfaces/relayer/IRelayProvider.sol";

contract RelayProvider is RelayProviderGovernance, IRelayProvider {
    error CallerNotApproved(address msgSender);

    //Returns the delivery overhead fee required to deliver a message to the target chain, denominated in this chain's wei.
    function quoteDeliveryOverhead(uint16 targetChainId)
        public
        view
        override
        returns (uint256 nativePriceQuote)
    {
        uint256 targetFees = uint256(deliverGasOverhead(targetChainId)) * gasPrice(targetChainId);
        return quoteAssetConversion(targetChainId, targetFees, chainId());
    }

    //Returns the price of purchasing 1 unit of gas on the target chain, denominated in this chain's wei.
    function quoteGasPrice(uint16 targetChainId) public view override returns (uint256) {
        return quoteAssetConversion(targetChainId, gasPrice(targetChainId), chainId());
    }

    //Returns the price of chainId's native currency in USD 10^-6 units
    function quoteAssetPrice(uint16 chainId) public view override returns (uint256) {
        return nativeCurrencyPrice(chainId);
    }

    //Returns the maximum budget that is allowed for a delivery on target chain, denominated in the target chain's wei.
    function quoteMaximumBudget(uint16 targetChainId)
        public
        view
        override
        returns (uint256 maximumTargetBudget)
    {
        return maximumBudget(targetChainId);
    }

    //Returns the address on this chain that rewards should be sent to
    function getRewardAddress() public view override returns (address payable) {
        return rewardAddress();
    }

    function isChainSupported(uint16 targetChainId) public view override returns (bool supported) {
        return _state.supportedChains[targetChainId];
    }

    function getTargetChainAddress(uint16 targetChainId)
        public
        view
        override
        returns (bytes32 relayProviderAddress)
    {
        return targetChainAddress(targetChainId);
    }

    //Returns a buffer amount, and a buffer denominator, whereby the bufferAmount / bufferDenominator will be reduced from
    //receiverValue conversions, giving an overhead to the provider on each conversion
    function getAssetConversionBuffer(uint16 targetChainId)
        public
        view
        override
        returns (uint16 tolerance, uint16 toleranceDenominator)
    {
        return assetConversionBuffer(targetChainId);
    }

    /**
     *
     * HELPER METHODS
     *
     */

    // relevant for chains that have dynamic execution pricing (e.g. Ethereum)
    function quoteAssetConversion(
        uint16 sourceChainId,
        uint256 sourceAmount,
        uint16 targetChainId
    ) internal view returns (uint256 targetAmount) {
        uint256 srcNativeCurrencyPrice = quoteAssetPrice(sourceChainId);
        uint256 dstNativeCurrencyPrice = quoteAssetPrice(targetChainId);

        // round up
        return (sourceAmount * srcNativeCurrencyPrice + dstNativeCurrencyPrice - 1)
            / dstNativeCurrencyPrice;
    }
}
