import fetch from "node-fetch";
import Elliptic from "elliptic";
import bs58 from "bs58";



// دالة لتحويل العنوان من Base58 إلى Hex
function tronAddressToHex(base58Address) {
    const decoded = bs58.decode(base58Address);
    let hexAddress = Buffer.from(decoded).toString("hex").toUpperCase();
    if (hexAddress.length > 42) {
        hexAddress = hexAddress.substring(0, 42);
    }
    return hexAddress;
}

// دالة للحصول على الرصيد
async function getBalance(address) {
    try {
        const response = await fetch(`https://api.shasta.trongrid.io/v1/accounts/${address}`);
        const data = await response.json();
        
        if (data.data && data.data[0]) {
            return data.data[0].balance / 1000000; // إرجاع الرصيد بـ TRX
        } else {
            console.log("🚨 لم يتم العثور على الحساب");
            return 0;
        }
    } catch (error) {
        console.error('🚨 خطأ أثناء جلب الرصيد:', error.message);
        return null;
    }
}

// دالة جديدة لتقدير تكلفة المعاملة
async function estimateTransactionCost(senderAddress, receiverAddress, amountInTrx) {
    try {
        // 1. الحصول على معاملات الشبكة الحالية
        const networkParams = await fetch('https://api.shasta.trongrid.io/wallet/getchainparameters')
            .then(res => res.json());
        
        // 2. استخراج أسعار الرسوم
        const feeParams = networkParams.chainParameter || [];
        const energyFee = parseInt(feeParams.find(p => p.key === "getEnergyFee")?.value || "420"); // sun/energy
        const bandwidthFee = parseInt(feeParams.find(p => p.key === "getTransactionFee")?.value || "1000"); // sun/bandwidth

        // 3. حساب التكاليف الثابتة لتحويل TRX
        const bandwidthCost = 266; // وحدات النطاق الترددي المطلوبة
        const energyCost = 0; // تحويل TRX عادي لا يستهلك طاقة

        // 4. حساب التكلفة الإجمالية (بالـ sun ثم تحويلها لـ TRX)
        const estimatedFeeInSun = (bandwidthCost * bandwidthFee) + (energyCost * energyFee);
        const estimatedFeeInTRX = estimatedFeeInSun / 1000000;

        // 5. الحصول على رسوم الشبكة الحقيقية من معاملة تجريبية
        const testTx = await createTransaction(senderAddress, receiverAddress, amountInTrx);
        const actualFee = testTx.raw_data?.fee_limit || 0;
        const actualFeeInTRX = actualFee / 1000000;

        return {
            success: true,
            estimatedFee: Math.max(estimatedFeeInTRX, actualFeeInTRX), // نأخذ القيمة الأعلى للتأكد
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
            note: "تحويل TRX العادي يستهلك نطاقًا تردديًا فقط (266 وحدة)"
        };
    } catch (error) {
        console.error('🚨 خطأ في تقدير التكلفة:', error);
        return {
            success: false,
            error: error.message,
            estimatedFee: 0.1, // قيمة افتراضية آمنة في حالة الخطأ
            note: "تم استخدام قيمة افتراضية بسبب خطأ في التقدير"
        };
    }
}
// دالة إنشاء المعاملة (كما هي)
async function createTransaction(senderAddress, receiverAddress, amountInTrx) {
    const ownerAddress = tronAddressToHex(senderAddress);
    const recipientAddress = tronAddressToHex(receiverAddress);
    try {
        const response = await fetch("https://api.shasta.trongrid.io/wallet/createtransaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_address: ownerAddress,
                to_address: recipientAddress,
                amount: amountInTrx * 1000000 
            })
        });
        return await response.json();
    } catch (error) {
        console.error('🚨 خطأ أثناء إنشاء المعاملة:', error.message);
        return null;
    }
}

// دالة توقيع المعاملة (كما هي)
function signTransaction(transaction, privateKey) {
    try {
        const EC = new Elliptic.ec("secp256k1");
        const key = EC.keyFromPrivate(privateKey, "hex");
        const msgHash = Buffer.from(transaction.txID, "hex");
        const signature = key.sign(msgHash, { canonical: true });
        const r = signature.r.toString('hex').padStart(64, '0');
        const s = signature.s.toString('hex').padStart(64, '0');
        const recoveryHex = signature.recoveryParam === 0 ? '1B' : '1C';
        transaction.signature = [r + s + recoveryHex];
        return transaction;
    } catch (error) {
        console.error('✍️ خطأ في توقيع المعاملة:', error.message);
        return null;
    }
}

// دالة إرسال المعاملة (كما هي)
async function sendTransaction(signedTx) {
    try {
        const broadcastResponse = await fetch("https://api.shasta.trongrid.io/wallet/broadcasttransaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(signedTx)
        });
        return await broadcastResponse.json();
    } catch (error) {
        console.error('🚨 خطأ أثناء إرسال المعاملة:', error.message);
        return null;
    }
}

// دالة تنفيذ المعاملة مع التحقق من التكلفة
async function executeTransaction(privateKey, senderAddress, receiverAddress, amountInTrx) {
    try {
        // التحقق من الرصيد
        const balance = await getBalance(senderAddress);
        if (balance === null || balance < amountInTrx) {
            console.error('❌ الرصيد غير كافٍ لإجراء المعاملة!');
            return;
        }

        // تقدير تكلفة المعاملة
        const costEstimation = await estimateTransactionCost(senderAddress, receiverAddress, amountInTrx);
        if (!costEstimation.success) {
            console.error('❌ فشل في تقدير تكلفة المعاملة');
            return;
        }

        console.log('💰 تقدير تكلفة المعاملة:');
        console.log(`- التكلفة المقدرة: ${costEstimation.estimatedFee.toFixed(6)} TRX`);
        console.log(`- المبلغ المراد إرساله: ${amountInTrx} TRX`);
        console.log(`- الإجمالي: ${(amountInTrx + costEstimation.estimatedFee).toFixed(6)} TRX`);
        console.log(`- الرصيد الحالي: ${balance.toFixed(6)} TRX`);

        // التحقق من أن الرصيد يكفي للمبلغ + التكلفة
        const totalCost = amountInTrx + costEstimation.estimatedFee;
        if (balance < totalCost) {
            console.error(`❌ الرصيد غير كافٍ! تحتاج إلى ${totalCost.toFixed(6)} TRX بينما رصيدك ${balance.toFixed(6)} TRX`);
            return;
        }

        // إنشاء المعاملة
        const transaction = await createTransaction(senderAddress, receiverAddress, amountInTrx);
        if (!transaction) return;

        // توقيع المعاملة
        const signedTx = signTransaction(transaction, privateKey);
        if (!signedTx) return;

        // بث المعاملة (يمكنك إلغاء التعليق عند التأكد)
        //const result = await sendTransaction(signedTx);
        // if (result && result.txid) {
        //     console.log(`✅ تم إرسال المعاملة بنجاح! TXID: ${result.txid}`);
        //     console.log(`🔍 تتبع المعاملة هنا: https://shasta.tronscan.org/#/transaction/${result.txid}`);
        // }
    } catch (error) {
        console.error('🚨 خطأ غير متوقع:', error.message);
    }
}

// معلومات الحساب
const privateKey = 'FBB19A194F2619AD53A01961BC4CC834368813030CC84032A55EC631D2722182'; 
const senderAddress = 'TRXu9WJF61NeEX2RZiefoeq2pKxmXPfdeZ';  
const receiverAddress = 'TWrW1vQbT9tmCBRrJNbeeuoJ9SbGTjUceK'; 
const amountInTrx = 1; 

// تنفيذ العملية
executeTransaction(privateKey, senderAddress, receiverAddress, amountInTrx);