document.addEventListener('DOMContentLoaded', function() {
    const executeBtn = document.getElementById('executeBtn');
    const checkBalanceBtn = document.getElementById('checkBalanceBtn');
    const loading = document.getElementById('loading');
    const resultContainer = document.getElementById('resultContainer');
    const resultContent = document.getElementById('resultContent');
    const errorContainer = document.getElementById('errorContainer');
    const successContainer = document.getElementById('successContainer');
    const balanceInfo = document.getElementById('balanceInfo');
    const networkSelect = document.getElementById('network');
    let currentNetwork = networkSelect.value;
    
    networkSelect.addEventListener('change', function() {
        currentNetwork = this.value;
    });
    
    function getApiUrl() {
        switch(currentNetwork) {
            case 'mainnet':
                return 'https://api.trongrid.io';
            case 'nile':
                return 'https://nile.trongrid.io';
            case 'shasta':
            default:
                return 'https://api.shasta.trongrid.io';
        }
    }
    
    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        successContainer.style.display = 'none';
    }
    
    function showSuccess(message) {
        successContainer.textContent = message;
        successContainer.style.display = 'block';
        errorContainer.style.display = 'none';
    }
    
    function clearMessages() {
        errorContainer.style.display = 'none';
        successContainer.style.display = 'none';
    }
    
    function showLoading() {
        loading.style.display = 'block';
        resultContainer.style.display = 'none';
        clearMessages();
    }
    
    function hideLoading() {
        loading.style.display = 'none';
    }
    
    function showResult(content) {
        resultContent.innerHTML = content;
        resultContainer.style.display = 'block';
    }
    
  function isValidTronAddress(address) {
    // Basic TRON address validation
    if (!address || typeof address !== 'string') return false;
    
    // TRON addresses start with 'T' and are 34 characters long
    if (!address.startsWith('T') || address.length !== 34) return false;
    
    // Check if it's a valid base58 string
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    return base58Regex.test(address);
}

function tronAddressToHex(base58Address) {
  const decoded = decode(base58Address);
  const hexAddress = bytesToHex(decoded);
  return hexAddress.length > 42 ? hexAddress.substring(0, 42) : hexAddress;
}


async function createTransaction(senderAddress, receiverAddress, amountInTrx) {
    // First validate addresses before conversion
    if (!isValidTronAddress(senderAddress)) {
        showError("Invalid sender address format");
        return null;
    }
    
    if (!isValidTronAddress(receiverAddress)) {
        showError("Invalid receiver address format");
        return null;
    }

    const ownerAddress = tronAddressToHex(senderAddress);
    const recipientAddress = tronAddressToHex(receiverAddress);
    const apiUrl = getApiUrl();
    
    if (!ownerAddress || !recipientAddress) {
        // Error message already shown by tronAddressToHex
        return null;
    }
    
    try {
        const response = await fetch(`${apiUrl}/wallet/createtransaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_address: ownerAddress,
                to_address: recipientAddress,
                amount: amountInTrx * 1000000 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.message || 'Failed to create transaction';
            showError(`API error: ${errorMsg}`);
            return null;
        }
        
        return await response.json();
    } catch (error) {
        showError(`Network error: ${error.message}`);
        return null;
    }
}
    async function getBalance(address) {
        try {
            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/v1/accounts/${address}`);
            const data = await response.json();
            
            if (data.data && data.data[0]) {
                return data.data[0].balance / 1000000;
            } else {
                showError("Account not found");
                return 0;
            }
        } catch (error) {
            showError(`Error fetching balance: ${error.message}`);
            return null;
        }
    }
    
    async function createTransaction(senderAddress, receiverAddress, amountInTrx) {
        const ownerAddress = tronAddressToHex(senderAddress);
        const recipientAddress = tronAddressToHex(receiverAddress);
        const apiUrl = getApiUrl();
        
        if (!ownerAddress || !recipientAddress) {
            showError("Invalid sender or receiver address");
            return null;
        }
        
        try {
            const response = await fetch(`${apiUrl}/wallet/createtransaction`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner_address: ownerAddress,
                    to_address: recipientAddress,
                    amount: amountInTrx * 1000000 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                showError(`API error: ${errorData.message || 'Failed to create transaction'}`);
                return null;
            }
            
            return await response.json();
        } catch (error) {
            showError(`Network error: ${error.message}`);
            return null;
        }
    }
    
    async function estimateTransactionCost(senderAddress, receiverAddress, amountInTrx) {
    try {
        const apiUrl = getApiUrl();
        
        // Get network parameters for fee calculation
        const networkParams = await fetch(`${apiUrl}/wallet/getchainparameters`)
            .then(res => res.json())
            .catch(err => {
                console.error('Error fetching chain parameters:', err);
                return { chainParameter: [] };
            });

        const feeParams = networkParams.chainParameter || [];
        const energyFee = parseInt(feeParams.find(p => p.key === "getEnergyFee")?.value || "420");
        const bandwidthFee = parseInt(feeParams.find(p => p.key === "getTransactionFee")?.value || "1000");

        // Default values for a simple TRX transfer
        const bandwidthCost = 266;  // Standard bandwidth cost for TRX transfer
        const energyCost = 0;       // No energy cost for simple TRX transfer

        // Calculate estimated fee
        const estimatedFeeInSun = (bandwidthCost * bandwidthFee) + (energyCost * energyFee);
        const estimatedFeeInTRX = estimatedFeeInSun / 1000000;

        // Try to create a test transaction (but don't fail if it doesn't work)
        let testTx = null;
        try {
            testTx = await createTransaction(senderAddress, receiverAddress, amountInTrx);
        } catch (error) {
            console.warn('Test transaction creation failed, using default fees:', error);
        }

        let actualFeeInTRX = estimatedFeeInTRX;
        if (testTx && testTx.raw_data?.fee_limit) {
            actualFeeInTRX = testTx.raw_data.fee_limit / 1000000;
        }

        return {
            success: true,
            estimatedFee: Math.max(estimatedFeeInTRX, actualFeeInTRX),
            details: {
                bandwidthUsed: bandwidthCost,
                bandwidthPrice: bandwidthFee,
                bandwidthCost: (bandwidthCost * bandwidthFee) / 1000000,
                energyUsed: energyCost,
                energyPrice: energyFee,
                energyCost: 0,
                rawDataFee: actualFeeInTRX,
                transaction: testTx
            },
            note: testTx ? "Normal TRX transfer consumes only bandwidth (266 units)" : 
                         "Using default fee calculation (test transaction failed)"
        };
    } catch (error) {
        console.error('Error estimating cost:', error);
        return {
            success: false,
            error: error.message,
            estimatedFee: 0.1,  // Fallback fee
            note: "Used default value due to estimation error"
        };
    }
}
    
  function signTransaction(transaction, privateKey) {
    try {
      

        const EC = elliptic.ec("secp256k1");
        const key = EC.keyFromPrivate(privateKey, "hex");
        
        // تحويل txID من hex إلى Uint8Array بدلاً من Buffer
        const msgHash = hexToUint8Array(transaction.txID);
        
        const signature = key.sign(msgHash, { canonical: true });
        const r = signature.r.toString('hex').padStart(64, '0');
        const s = signature.s.toString('hex').padStart(64, '0');
        const recoveryHex = signature.recoveryParam === 0 ? '1B' : '1C';
        transaction.signature = [r + s + recoveryHex];
        return transaction;
    } catch (error) {
        console.error(`Error signing transaction: ${error.message}`);
        return null;
    }
}



// دالة مساعدة لتحويل hex string إلى Uint8Array
function hexToUint8Array(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error('Hex string must have even length');
    }
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i/2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
}
    
    async function sendTransaction(signedTx) {
        try {
            const apiUrl = getApiUrl();
            const broadcastResponse = await fetch(`${apiUrl}/wallet/broadcasttransaction`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(signedTx)
            });
            return await broadcastResponse.json();
        } catch (error) {
            
            showError(`Error sending transaction: ${error.message}`);
            return null;
        }
    }
    
    
    async function executeTransaction() {
        const privateKey = document.getElementById('privateKey').value.trim();
        const senderAddress = document.getElementById('senderAddress').value.trim();
        const receiverAddress = document.getElementById('receiverAddress').value.trim();
        const amountInTrx = parseFloat(document.getElementById('amount').value);
        
        if (!privateKey || !senderAddress || !receiverAddress || isNaN(amountInTrx)) {
            showError("Please fill in all fields with valid values");
            return;
        }
        
        if (amountInTrx <= 0) {
            showError("Amount must be greater than 0");
            return;
        }
        
        showLoading();
        
        try {
            const balance = await getBalance(senderAddress);
            if (balance === null || balance < amountInTrx) {
                showError('Insufficient balance to perform the transaction!');
                hideLoading();
                return;
            }

            const costEstimation = await estimateTransactionCost(senderAddress, receiverAddress, amountInTrx);
            if (!costEstimation.success) {
                showError(`Failed to estimate transaction cost: ${costEstimation.error || 'Unknown error'}`);
                hideLoading();
                return;
            }

            const totalCost = amountInTrx + costEstimation.estimatedFee;
            if (balance < totalCost) {
                showError(`Insufficient balance! You need ${totalCost.toFixed(6)} TRX but your balance is ${balance.toFixed(6)} TRX`);
                hideLoading();
                return;
            }

            let resultHtml = `
                <div class="result-item">
                    <strong>Transaction Summary:</strong><br>
                    - From: ${senderAddress}<br>
                    - To: ${receiverAddress}<br>
                    - Amount: ${amountInTrx} TRX<br>
                    - Estimated Fee: ${costEstimation.estimatedFee.toFixed(6)} TRX<br>
                    - Total Cost: ${totalCost.toFixed(6)} TRX<br>
                    - Your Balance: ${balance.toFixed(6)} TRX
                </div>
                
                <div class="fee-details">
                    <strong>Fee Details:</strong><br>
                    <div class="fee-item"><span>Bandwidth Used:</span> <span>${costEstimation.details.bandwidthUsed} units</span></div>
                    <div class="fee-item"><span>Bandwidth Price:</span> <span>${costEstimation.details.bandwidthPrice} sun/unit</span></div>
                    <div class="fee-item"><span>Bandwidth Cost:</span> <span>${costEstimation.details.bandwidthCost.toFixed(6)} TRX</span></div>
                    <div class="fee-item"><span>Energy Used:</span> <span>${costEstimation.details.energyUsed} units</span></div>
                    <div class="fee-item"><span>Energy Price:</span> <span>${costEstimation.details.energyPrice} sun/unit</span></div>
                    <div class="fee-item"><span>Energy Cost:</span> <span>${costEstimation.details.energyCost.toFixed(6)} TRX</span></div>
                    <div class="fee-item"><span>Raw Data Fee:</span> <span>${costEstimation.details.rawDataFee.toFixed(6)} TRX</span></div>
                </div>
                
                <div class="result-item">
                    <strong>Note:</strong> ${costEstimation.note}
                </div>
            `;
            
            showResult(resultHtml);
            hideLoading();
            
            const confirmed = confirm(`You are about to send ${amountInTrx} TRX to ${receiverAddress}\n\nTotal cost (including fees): ${totalCost.toFixed(6)} TRX\n\nDo you want to proceed?`);
            
            if (confirmed) {
                showLoading();
                
                const transaction = await createTransaction(senderAddress, receiverAddress, amountInTrx);
                if (!transaction) {
                    hideLoading();
                    return;
                }
                const signedTx = signTransaction(transaction, privateKey);
                if (!signedTx) {
                    hideLoading();
                    return;
                }
                const result = await sendTransaction(signedTx);
                if (result && result.txid) {
                    const explorerUrl = currentNetwork === 'mainnet' 
                        ? `https://tronscan.org/#/transaction/${result.txid}`
                        : currentNetwork === 'nile'
                            ? `https://nile.tronscan.org/#/transaction/${result.txid}`
                            : `https://shasta.tronscan.org/#/transaction/${result.txid}`;
                    
                    showSuccess(`Transaction sent successfully! TXID: ${result.txid}`);
                    resultHtml += `
                        <div class="result-item" style="border-left-color: var(--success);">
                            <strong>Transaction Result:</strong><br>
                            - Status: Success<br>
                            - TXID: ${result.txid}<br>
                            - <a href="${explorerUrl}" target="_blank">View on Tronscan</a>
                        </div>
                    `;
                    showResult(resultHtml);
                } else {
                    showError('Failed to send transaction');
                }
            }
        } catch (error) {
            showError(`Unexpected error: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    async function checkBalance() {
        const senderAddress = document.getElementById('senderAddress').value.trim();
        
        if (!senderAddress) {
            showError("Please enter a sender address");
            return;
        }
        
        showLoading();
        
        try {
            const balance = await getBalance(senderAddress);
            if (balance !== null) {
                balanceInfo.innerHTML = `Current Balance: <strong>${balance.toFixed(6)} TRX</strong>`;
                balanceInfo.style.display = 'block';
                showSuccess(`Balance checked successfully for address: ${senderAddress}`);
            }
        } catch (error) {
            showError(`Error checking balance: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    executeBtn.addEventListener('click', executeTransaction);
    checkBalanceBtn.addEventListener('click', checkBalance);
});