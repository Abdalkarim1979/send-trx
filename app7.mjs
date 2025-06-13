import  {TronWeb}  from 'tronweb';

// 🔹 إعداد TronWeb
function initializeTronWeb(privateKey) {
    const fullNode = 'https://api.shasta.trongrid.io';
    const solidityNode = 'https://api.shasta.trongrid.io';
    const eventServer = 'https://api.shasta.trongrid.io';

    return new TronWeb(fullNode, solidityNode, eventServer, privateKey);
}

// 🔹 التحقق من الرصيد
async function checkBalance(tronWeb, address) {
    try {
        const account = await tronWeb.trx.getAccount(address);
        const balanceTrx = tronWeb.fromSun(account.balance || 0);
        console.log(`💰 رصيد ${address}: ${balanceTrx} TRX`);
        return balanceTrx;
    } catch (error) {
        console.error('🚨 خطأ أثناء جلب الرصيد:', error.message);
        return null;
    }
}

// 🔹 تقدير تكلفة المعاملة
async function estimateTransactionCost(tronWeb, senderAddress, receiverAddress, amountInTrx) {
    try {
        const amountInSun = tronWeb.toSun(amountInTrx);
        const transaction = await tronWeb.transactionBuilder.sendTrx(receiverAddress, amountInSun, senderAddress);
        const signedTx = await tronWeb.trx.sign(transaction);
        const transactionSize = signedTx.raw_data_hex.length / 2; // عدد البايتات

        const bandwidthCost = transactionSize; // كل بايت يستهلك 1 Bandwidth
        const energyCost = 0; // لا توجد تكلفة Energy في تحويل TRX العادي

        console.log(`📏 Bandwidth مقدر: ${bandwidthCost}`);
        console.log(`🔋 Energy مقدر: ${energyCost}`);
        console.log(`💰 التكلفة التقريبية: ${tronWeb.fromSun(bandwidthCost)} TRX`);

        return { bandwidthCost, energyCost };
    } catch (error) {
        console.error('🚨 خطأ أثناء تقدير تكلفة المعاملة:', error.message);
        return null;
    }
}

// 🔹 إنشاء المعاملة
async function createTransaction(tronWeb, senderAddress, receiverAddress, amountInTrx) {
    try {
        const amountInSun = tronWeb.toSun(amountInTrx);
        const transaction = await tronWeb.transactionBuilder.sendTrx(receiverAddress, amountInSun, senderAddress);
        console.log('✅ تم إنشاء المعاملة:', transaction);
        return transaction;
    } catch (error) {
        console.error('🚨 خطأ أثناء إنشاء المعاملة:', error.message);
        return null;
    }
}

// 🔹 توقيع المعاملة
async function signTransaction(tronWeb, transaction) {
    try {
        const signedTx = await tronWeb.trx.sign(transaction);
        console.log('✍️ تم توقيع المعاملة:', signedTx);
        return signedTx;
    } catch (error) {
        console.error('🚨 خطأ أثناء توقيع المعاملة:', error.message);
        return null;
    }
}

// 🔹 بث المعاملة
async function sendTransaction(tronWeb, signedTx) {
    try {
        const result = await tronWeb.trx.sendRawTransaction(signedTx);
        if (result.txid) {
            console.log(`✅ تم إرسال المعاملة بنجاح! TXID: ${result.txid}`);
            console.log(`🔍 تتبع المعاملة هنا: https://tronscan.org/#/transaction/${result.txid}`);
        } else {
            console.error('❌ فشل إرسال المعاملة:', result);
        }
    } catch (error) {
        console.error('🚨 خطأ أثناء إرسال المعاملة:', error.message);
    }
}

// 🔹 تنفيذ العملية بالكامل
async function executeTransaction(privateKey, senderAddress, receiverAddress, amountInTrx) {
    const tronWeb = initializeTronWeb(privateKey);

    // التحقق من الرصيد
    const balance = await checkBalance(tronWeb, senderAddress);
    if (balance < amountInTrx) {
        console.error('❌ الرصيد غير كافٍ لإجراء المعاملة!');
        return;
    }

    // تقدير التكلفة قبل الإرسال
    await estimateTransactionCost(tronWeb, senderAddress, receiverAddress, amountInTrx);

    // إنشاء المعاملة
    const transaction = await createTransaction(tronWeb, senderAddress, receiverAddress, amountInTrx);
    if (!transaction) return;

    // توقيع المعاملة
    const signedTx = await signTransaction(tronWeb, transaction);
    if (!signedTx) return;

    // بث المعاملة
    await sendTransaction(tronWeb, signedTx);
}
 const privateKey = 'FBB19A194F2619AD53A01961BC4CC834368813030CC84032A55EC631D2722182'; // استبدل بهذا المفتاح الخاص للمحفظة المرسلة
    const senderAddress = 'TRXu9WJF61NeEX2RZiefoeq2pKxmXPfdeZ';   // استبدل بهذا عنوان المحفظة المرسلة
    // **********************************

    const receiverAddress = 'TWrW1vQbT9tmCBRrJNbeeuoJ9SbGTjUceK'; // استبدل بهذا عنوان المحفظة المستلمة
    const amountInTrx = 1; // المبلغ المراد إرساله من TRX

// 🔹 تنفيذ العملية
executeTransaction(privateKey, senderAddress, receiverAddress , amountInTrx);
