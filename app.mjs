// التأكد من تحميل مكتبة TronWeb


import { TronWeb, utils, Trx, TransactionBuilder, Contract, Event, Plugin } from 'tronweb';


if (typeof TronWeb === "undefined") {
    console.error("🚨 خطأ: مكتبة TronWeb.js لم يتم تحميلها!");
} else {
    async function generateWallet() {
        // توليد مفتاح خاص عشوائي
       // const wallet = utils.accounts.generateAccount();

        // عرض المعلومات في وحدة التحكم
      //  console.log("🔑 المفتاح الخاص:", wallet.privateKey);
       // console.log("🏦 عنوان المحفظة:", wallet.address);
        
        // إعداد اتصال بـ شبكة TRON
   

     const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    headers: { "5de21947-fb6f-449d-9e22-282537efd7f6": 'mynet' },
    privateKey: "FBB19A194F2619AD53A01961BC4CC834368813030CC84032A55EC631D2722182"
})
        try {
            const balance = await tronWeb.trx.getBalance("41AAB8B59CCFA5E3BBE4112AFA4497DD1D84B8605F");
            console.log("💳 الرصيد:", balance / 1000000, "TRX");
        } catch (error) {
            console.error("🚨 خطأ أثناء جلب الرصيد:", error);
        }
    }

    // تشغيل الوظيفة لتوليد المحفظة
    generateWallet();
}
