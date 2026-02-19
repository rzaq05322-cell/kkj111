// --- المتغيرات العامة ---
let products = [];
let customers = [];
let invoices = [];
let expenses = [];
let debtors = [];
let currentCart = [];
let lastInvoice = null;
let currentSettings = { name: '', phone: '' };

// المتغيرات الخاصة بعمليات الحذف الآمنة
let pendingDeleteAction = null; 

// الاستماع لحدث جاهزية قاعدة البيانات
window.addEventListener('firebaseReady', () => {
    loadData();
    loadSettings();
    // إخفاء شاشة الترحيب بعد 3 ثواني
    setTimeout(() => {
        const overlay = document.getElementById('intro-overlay');
        if(overlay) overlay.style.display = 'none';
    }, 3500);
});

// دالة تنسيق العملة والأرقام 
function fmtNum(num) {
    if(!num && num !== 0) return '0';
    return Number(num).toLocaleString('en-US') + ' د.ع';
}

// دالة عرض التنبيهات 
function showToast(msg, type = 'info') {
    const box = document.getElementById('customAlert');
    box.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
    box.style.display = 'block';
    box.style.borderColor = type === 'error' ? '#ff416c' : '#00b09b';
    setTimeout(() => { box.style.display = 'none'; }, 3000);
}

// --- 1. إدارة البيانات (Firebase + Local) ---
function loadData() {
    // جلب السلع
    window.onSnapshot(window.collection(window.db, "products"), (snapshot) => {
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
        updateSaleDatalists();
    });

    // جلب الزبائن
    window.onSnapshot(window.collection(window.db, "customers"), (snapshot) => {
        customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderCustomers();
        renderRecordsCustomers();
        updateSaleDatalists();
    });

    // جلب الفواتير
    window.onSnapshot(window.collection(window.db, "invoices"), (snapshot) => {
        invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
        calculateFinancialStats(); 
        renderExpenses(); // لتحديث رصيد مبيعات اليوم
    });

    // جلب المصروفات
    window.onSnapshot(window.collection(window.db, "expenses"), (snapshot) => {
        expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderExpenses();
    });

    // جلب المدينين
    window.onSnapshot(window.collection(window.db, "debtors"), (snapshot) => {
        debtors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDebtors();
        if(currentActiveDebtorId) openDebtor(currentActiveDebtorId);
    });
}

function loadSettings() {
    const saved = localStorage.getItem('shopSettings');
    if(saved) {
        currentSettings = JSON.parse(saved);
        document.getElementById('shopName').value = currentSettings.name;
        document.getElementById('shopPhone').value = currentSettings.phone;
    }
}

// --- 2. التنقل ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'settings') calculateFinancialStats();
    if(tabId === 'expenses') renderExpenses();
    if(event && event.target) event.target.classList.add('active');
}

// --- 3. تبويبة السلع ---
async function addProduct() {
    const name = document.getElementById('prodName').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const wholesale = parseFloat(document.getElementById('prodWholesale').value) || price;
    const qty = parseInt(document.getElementById('prodQty').value);

    if (name && price && qty) {
        await window.addDoc(window.collection(window.db, "products"), {
            name, price, wholesale, qty, createdAt: new Date().toISOString()
        });
        document.getElementById('prodName').value = '';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodWholesale').value = '';
        document.getElementById('prodQty').value = '';
        showToast('تمت إضافة السلعة بنجاح');
    } else {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
    }
}

function renderProducts() {
    const list = document.getElementById('productsList');
    list.innerHTML = products.map(p => `
        <div class="list-item">
            <div>
                <strong>${p.name}</strong> (العدد: ${p.qty})<br>
                <small>مفرد: ${fmtNum(p.price)} | جملة: ${fmtNum(p.wholesale || p.price)}</small>
            </div>
            <button class="delete-btn" onclick="requestDelete('products', '${p.id}')">حذف</button>
        </div>
    `).join('');
}

// --- 4. تبويبة الزبائن ---
async function addCustomer() {
    const name = document.getElementById('custName').value;
    const phone = document.getElementById('custPhone').value;
    const address = document.getElementById('custAddress').value;

    if (name && phone) {
        await window.addDoc(window.collection(window.db, "customers"), {
            name, phone, address, createdAt: new Date().toISOString()
        });
        document.getElementById('custName').value = '';
        document.getElementById('custPhone').value = '';
        document.getElementById('custAddress').value = '';
        showToast('تمت إضافة الزبون');
    } else {
        showToast('الاسم والهاتف مطلوبان', 'error');
    }
}

function renderCustomers() {
    const search = document.getElementById('custSearch').value.toLowerCase();
    const list = document.getElementById('customersList');
    const filtered = customers.filter(c => c.name.toLowerCase().includes(search));
    list.innerHTML = filtered.map(c => `
        <div class="list-item">
            <span>${c.name} (${c.phone})</span>
            <button class="delete-btn" onclick="requestDelete('customers', '${c.id}')">حذف</button>
        </div>
    `).join('');
}

// --- نظام الحماية 121 ---
function requestDelete(col, id) {
    pendingDeleteAction = { col, id };
    document.getElementById('securityPin').value = '';
    document.getElementById('pinModal').style.display = 'flex';
    document.getElementById('securityPin').focus();
}

function closePinModal() {
    document.getElementById('pinModal').style.display = 'none';
    pendingDeleteAction = null;
}

async function verifyPin() {
    const pin = document.getElementById('securityPin').value;
    if (pin === '121') {
        if (pendingDeleteAction) {
            await window.deleteDoc(window.doc(window.db, pendingDeleteAction.col, pendingDeleteAction.id));
            showToast('تم الحذف بنجاح');
            closePinModal();
        }
    } else {
        showToast('الرمز خطأ! حاول مرة أخرى', 'error');
    }
}

// --- 5. تبويبة البيع ---

function updateSaleDatalists() {
    const custDL = document.getElementById('custDataList');
    custDL.innerHTML = customers.map(c => `<option value="${c.name}" data-id="${c.id}"></option>`).join('');

    const prodDL = document.getElementById('prodDataList');
    prodDL.innerHTML = products.map(p => `<option value="${p.name}"></option>`).join('');
}

function selectCustomerFromSearch() {
    const val = document.getElementById('saleCustSearch').value;
    const customer = customers.find(c => c.name === val);
    if(customer) {
        document.getElementById('selectedCustId').value = customer.id;
    } else {
        document.getElementById('selectedCustId').value = '';
    }
}

function checkProductStock() {
    const val = document.getElementById('saleProdSearch').value;
    const product = products.find(p => p.name === val);
    const stockDisplay = document.getElementById('stockDisplay');
    const stockVal = document.getElementById('currentStockVal');

    if(product) {
        stockDisplay.style.display = 'block';
        stockVal.innerText = product.qty;
    } else {
        stockDisplay.style.display = 'none';
    }
}

function addToCart() {
    const prodName = document.getElementById('saleProdSearch').value;
    const qtyInput = document.getElementById('saleQty');
    const requestQty = parseInt(qtyInput.value);
    const priceType = document.getElementById('salePriceType').value;

    const product = products.find(p => p.name === prodName);

    if (!product) {
        showToast("يرجى اختيار سلعة صحيحة", 'error');
        return;
    }

    if (requestQty > product.qty) {
        showToast(`المخزون لا يكفي! المتاح فقط: ${product.qty}`, 'error');
        qtyInput.value = product.qty;
        return;
    }

    const unitPrice = priceType === 'wholesale' ? (product.wholesale || product.price) : product.price;
    const total = unitPrice * requestQty;
    
    currentCart.push({ 
        prodId: product.id, 
        name: product.name, 
        price: unitPrice, 
        qty: requestQty, 
        total: total 
    });

    renderCart();
    document.getElementById('saleProdSearch').value = '';
    document.getElementById('stockDisplay').style.display = 'none';
    qtyInput.value = 1;
}

function renderCart() {
    const cartDiv = document.getElementById('cartItems');
    let grandTotal = 0;
    
    cartDiv.innerHTML = currentCart.map((item, idx) => {
        grandTotal += item.total;
        return `<div style="display:flex; justify-content:space-between; font-size:0.9em; margin-bottom:5px;">
            <span>${item.name} x${item.qty}</span>
            <span>${fmtNum(item.total)}</span>
            <span style="color:red; cursor:pointer" onclick="removeFromCart(${idx})">x</span>
        </div>`;
    }).join('');

    document.getElementById('cartTotal').innerText = fmtNum(grandTotal);
}

function removeFromCart(idx) {
    currentCart.splice(idx, 1);
    renderCart();
}

async function checkout() {
    const custId = document.getElementById('selectedCustId').value;
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const total = currentCart.reduce((sum, item) => sum + item.total, 0);

    if (!custId || currentCart.length === 0) {
        showToast("تأكد من اختيار زبون صحيح وإضافة سلع", 'error');
        return;
    }

    // خصم المخزون
    for (let item of currentCart) {
        const product = products.find(p => p.id === item.prodId);
        if(product) {
            await window.updateDoc(window.doc(window.db, "products", product.id), {
                qty: product.qty - item.qty
            });
        }
    }

    const remaining = total - paid;
    
    const invoice = {
        date: new Date().toISOString(),
        custId: custId,
        items: [...currentCart],
        total: total,
        paid: paid,
        remaining: remaining
    };

    const docRef = await window.addDoc(window.collection(window.db, "invoices"), invoice);
    
    invoice.id = docRef.id;
    lastInvoice = invoice;

    currentCart = [];
    renderCart();
    document.getElementById('amountPaid').value = '';
    document.getElementById('saleCustSearch').value = '';
    
    showInvoiceModal(invoice);
}

// --- 6. تبويبة السجلات ---
function renderRecordsCustomers() {
    const search = document.getElementById('recordSearch').value.toLowerCase();
    const container = document.getElementById('recordsListContainer');
    
    const filteredCusts = customers.filter(c => c.name.toLowerCase().includes(search));

    container.innerHTML = filteredCusts.map(c => {
        const custInvoices = invoices.filter(inv => inv.custId === c.id);
        let debt = 0;
        custInvoices.forEach(inv => debt += (inv.remaining || 0));

        return `
        <div class="list-item" onclick="openCustomerRecords('${c.id}')" style="cursor:pointer">
            <div><strong>${c.name}</strong></div>
            <div style="text-align:left">
                <span style="color:${debt > 0 ? '#ff416c' : '#00b09b'}">الديون: ${fmtNum(debt)}</span>
            </div>
        </div>`;
    }).join('');
}

let currentRecordCustId = null;

function openCustomerRecords(custId) {
    currentRecordCustId = custId;
    const customer = customers.find(c => c.id === custId);
    const custInvoices = invoices.filter(inv => inv.custId === custId).sort((a,b) => new Date(b.date) - new Date(a.date));
    
    document.getElementById('recordsCustomerList').style.display = 'none';
    document.getElementById('customerRecordsDetail').style.display = 'block';

    document.getElementById('recCustName').innerText = `سجل: ${customer.name}`;
    updateCustomerDebtDisplay(custId);

    const invoicesHtml = custInvoices.map(inv => {
        const isPayment = inv.items.length === 0; 
        return `
        <div style="border:1px solid rgba(255,255,255,0.2); padding:10px; margin-bottom:10px; border-radius:5px; background:rgba(0,0,0,0.1)">
            <div style="display:flex; justify-content:space-between">
                <span>${new Date(inv.date).toLocaleDateString()}</span>
                <span style="font-weight:bold">${isPayment ? 'تسديد دين' : 'فاتورة بيع'}</span>
            </div>
            ${!isPayment ? `<small>المواد: ${inv.items.map(i=>i.name).join(', ')}</small><br>` : ''}
            <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.9em">
                <span>المبلغ: ${fmtNum(inv.total)}</span>
                <span>واصل: ${fmtNum(inv.paid)}</span>
                <span style="color:${inv.remaining > 0 ? '#ff416c' : '#4caf50'}">باقي: ${fmtNum(inv.remaining)}</span>
            </div>
            <button class="action-btn" style="padding:5px; font-size:0.8em; margin-top:5px; background:#25D366" onclick="shareInvoiceWhatsApp('${inv.id}')">مشاركة واتساب</button>
        </div>`;
    }).join('');

    document.getElementById('custSpecificInvoices').innerHTML = invoicesHtml || '<p>لا توجد سجلات.</p>';
}

function updateCustomerDebtDisplay(custId) {
    const custInvoices = invoices.filter(inv => inv.custId === custId);
    let totalDebt = 0;
    custInvoices.forEach(inv => totalDebt += (inv.remaining || 0));
    document.getElementById('recTotalDebt').innerText = fmtNum(totalDebt);
}

function closeCustomerRecords() {
    document.getElementById('customerRecordsDetail').style.display = 'none';
    document.getElementById('recordsCustomerList').style.display = 'block';
    currentRecordCustId = null;
}

async function payDebt() {
    const amount = parseFloat(document.getElementById('payDebtAmount').value);
    if(!amount || !currentRecordCustId) return;

    const paymentRecord = {
        date: new Date().toISOString(),
        custId: currentRecordCustId,
        items: [],
        total: 0,
        paid: amount,
        remaining: -amount 
    };

    await window.addDoc(window.collection(window.db, "invoices"), paymentRecord);
    document.getElementById('payDebtAmount').value = '';
    openCustomerRecords(currentRecordCustId);
    showToast("تم تسجيل التسديد");
}

// --- 7. الفاتورة والطباعة ---
function showInvoiceModal(invoice) {
    const customer = customers.find(c => c.id === invoice.custId);
    
    document.getElementById('printShopName').innerText = currentSettings.name || 'فاتورة مبيعات';
    document.getElementById('printShopPhone').innerText = currentSettings.phone || '';

    document.getElementById('invDate').innerText = new Date(invoice.date).toLocaleString();
    document.getElementById('invCust').innerText = customer ? customer.name : 'زبون غير موجود';
    document.getElementById('invItems').innerHTML = invoice.items.map(i => `
        <tr><td>${i.name}</td><td>${i.qty}</td><td>${fmtNum(i.total)}</td></tr>
    `).join('');
    
    document.getElementById('invTotal').innerText = fmtNum(invoice.total);
    document.getElementById('invPaid').innerText = fmtNum(invoice.paid);
    document.getElementById('invRem').innerText = fmtNum(invoice.remaining);

    document.getElementById('invoiceModal').style.display = 'flex';
}

function closeInvoice() {
    document.getElementById('invoiceModal').style.display = 'none';
}

function formatPhoneNumber(rawNumber) {
    let phone = rawNumber.trim();
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('964')) phone = '964' + phone;
    return phone;
}

function sendWhatsApp() {
    if (!lastInvoice) return;
    shareInvoiceWhatsAppHelper(lastInvoice);
}

function shareInvoiceWhatsApp(invId) {
    const inv = invoices.find(i => i.id === invId);
    if(inv) shareInvoiceWhatsAppHelper(inv);
}

function shareInvoiceWhatsAppHelper(invoice) {
    const customer = customers.find(c => c.id === invoice.custId);
    if(!customer) return;

    const phone = formatPhoneNumber(customer.phone);
    const shopName = currentSettings.name ? `*${currentSettings.name}*` : '*فاتورة مبيعات*';

    let message = `${shopName}%0a`;
    message += `مرحباً ${customer.name}%0a`;
    message += `التاريخ: ${new Date(invoice.date).toLocaleDateString()}%0a`;
    
    if(invoice.items.length > 0) {
        message += `------------------%0a`;
        invoice.items.forEach(item => {
            message += `${item.name} (عدد ${item.qty}): ${fmtNum(item.total)}%0a`;
        });
        message += `------------------%0a`;
    } else {
        message += `*دفعة تسديد حساب*%0a`;
    }
    
    message += `المطلوب: ${fmtNum(invoice.total)}%0a`;
    message += `الواصل: ${fmtNum(invoice.paid)}%0a`;
    message += `الباقي في هذه القائمة: ${fmtNum(invoice.remaining)}%0a`;
    
    if(currentSettings.phone) message += `%0aللاستفسار: ${currentSettings.phone}`;

    const url = `https://wa.me/${phone}?text=${message}`;
    window.open(url, '_blank');
}

// --- 8. الإعدادات والمالية ---
function saveSettings() {
    const name = document.getElementById('shopName').value;
    const phone = document.getElementById('shopPhone').value;
    currentSettings = { name, phone };
    localStorage.setItem('shopSettings', JSON.stringify(currentSettings));
    showToast('تم حفظ الإعدادات');
}

function calculateFinancialStats() {
    const monthFilter = document.getElementById('statsMonthSelect').value;
    let totalRevenue = 0; 
    let totalDebt = 0;    

    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const invMonth = (invDate.getMonth() + 1).toString();
        
        if(monthFilter === 'all' || monthFilter === invMonth) {
            totalRevenue += (inv.paid || 0);
            totalDebt += (inv.remaining || 0);
        }
    });

    document.getElementById('totalRevenueDisplay').innerText = fmtNum(totalRevenue);
    document.getElementById('totalDebtDisplay').innerText = fmtNum(totalDebt);
}

function resetStatsFilter() {
    document.getElementById('statsMonthSelect').value = 'all';
    calculateFinancialStats();
    showToast('تم إعادة تعيين الفلاتر');
}

// النسخ الاحتياطي
function backupData() {
    const data = {
        products: products,
        customers: customers,
        invoices: invoices,
        expenses: expenses,
        debtors: debtors,
        settings: currentSettings
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// استعادة البيانات
async function restoreData() {
    const fileInput = document.getElementById('restoreFile');
    const file = fileInput.files[0];
    if(!file) {
        showToast('يرجى اختيار ملف JSON أولاً', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if(confirm('سيتم إضافة البيانات فوق البيانات الحالية، هل أنت متأكد؟')) {
                if(data.products) for(let p of data.products) { const { id, ...pData } = p; await window.addDoc(window.collection(window.db, "products"), pData); }
                if(data.customers) for(let c of data.customers) { const { id, ...cData } = c; await window.addDoc(window.collection(window.db, "customers"), cData); }
                if(data.invoices) for(let inv of data.invoices) { const { id, ...iData } = inv; await window.addDoc(window.collection(window.db, "invoices"), iData); }
                if(data.expenses) for(let exp of data.expenses) { const { id, ...eData } = exp; await window.addDoc(window.collection(window.db, "expenses"), eData); }
                if(data.debtors) for(let d of data.debtors) { const { id, ...dData } = d; await window.addDoc(window.collection(window.db, "debtors"), dData); }
                
                showToast('تم استعادة البيانات بنجاح! سيتم التحديث...');
                setTimeout(() => location.reload(), 2000);
            }
        } catch(err) {
            console.error(err);
            showToast('الملف غير صالح', 'error');
        }
    };
    reader.readAsText(file);
}

// --- 9. نظام المصروفات (صرفيات اليوم) ---
async function addExpense() {
    const amount = parseFloat(document.getElementById('expAmount').value);
    const notes = document.getElementById('expNotes').value || 'بدون ملاحظات';
    
    if (amount) {
        await window.addDoc(window.collection(window.db, "expenses"), {
            amount, notes, date: new Date().toISOString()
        });
        document.getElementById('expAmount').value = '';
        document.getElementById('expNotes').value = '';
        showToast('تم إضافة المصروف');
    } else {
        showToast('يرجى إدخال المبلغ', 'error');
    }
}

function renderExpenses() {
    let todaySales = 0;
    let todayExpenses = 0;
    const todayStr = new Date().toDateString();

    invoices.forEach(inv => {
        if(new Date(inv.date).toDateString() === todayStr) {
            todaySales += (inv.paid || 0);
        }
    });

    const list = document.getElementById('expensesList');
    list.innerHTML = expenses.map(e => {
        const expDateStr = new Date(e.date).toDateString();
        if(expDateStr === todayStr) {
            todayExpenses += (e.amount || 0);
        }
        
        // عرض فقط مصروفات اليوم
        if(expDateStr === todayStr) {
            return `
            <div class="list-item">
                <div>
                    <strong style="color:#ff416c;">${fmtNum(e.amount)}</strong><br>
                    <small>${e.notes}</small><br>
                    <small style="color:rgba(255,255,255,0.6)">${new Date(e.date).toLocaleTimeString()}</small>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="action-btn" style="padding:5px; width:auto; background:#f0ad4e;" onclick="editExpense('${e.id}')">تعديل</button>
                    <button class="delete-btn" onclick="requestDelete('expenses', '${e.id}')">حذف</button>
                </div>
            </div>`;
        }
        return '';
    }).join('');

    const netBalance = todaySales - todayExpenses;
    document.getElementById('todaySalesBalance').innerText = fmtNum(netBalance);
}

async function editExpense(id) {
    const exp = expenses.find(e => e.id === id);
    if(!exp) return;
    
    const newAmount = prompt("أدخل المبلغ الجديد:", exp.amount);
    if(newAmount === null) return; 
    
    const newNotes = prompt("أدخل الملاحظات الجديدة:", exp.notes);
    
    if(!isNaN(newAmount) && newAmount !== "") {
        await window.updateDoc(window.doc(window.db, "expenses", id), {
            amount: parseFloat(newAmount),
            notes: newNotes !== null ? newNotes : exp.notes
        });
        showToast('تم تعديل المصروف');
    }
}

// --- 10. نظام المدين المستقل ---
let currentActiveDebtorId = null;

async function addDebtor() {
    const amount = parseFloat(document.getElementById('debtorAmount').value);
    const notes = document.getElementById('debtorNotes').value;
    
    if (amount && notes) {
        await window.addDoc(window.collection(window.db, "debtors"), {
            balance: amount,
            notes: notes,
            createdAt: new Date().toISOString(),
            transactions: []
        });
        document.getElementById('debtorAmount').value = '';
        document.getElementById('debtorNotes').value = '';
        showToast('تم إضافة المدين');
    } else {
        showToast('الرجاء إدخال المبلغ والملاحظات', 'error');
    }
}

function renderDebtors() {
    const list = document.getElementById('debtorsList');
    list.innerHTML = debtors.map(d => `
        <div class="list-item" onclick="openDebtor('${d.id}')" style="cursor:pointer">
            <span>${d.notes}</span>
            <span style="color:#ff416c; font-weight:bold;">${fmtNum(d.balance)}</span>
        </div>
    `).join('');
}

function openDebtor(id) {
    currentActiveDebtorId = id;
    const debtor = debtors.find(d => d.id === id);
    if(!debtor) return;

    document.getElementById('debtorsMain').style.display = 'none';
    document.getElementById('debtorDetail').style.display = 'block';

    document.getElementById('detDebtorNotes').innerText = debtor.notes;
    document.getElementById('detDebtorBalance').innerText = fmtNum(debtor.balance);

    const transHtml = (debtor.transactions || []).map(t => `
        <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding:10px 0; display:flex; justify-content:space-between;">
            <span style="color:#00b09b;">تسديد: ${fmtNum(t.amount)}</span>
            <small style="color:#aaa">${new Date(t.date).toLocaleString()}</small>
        </div>
    `).join('');
    
    document.getElementById('debtorTransactions').innerHTML = transHtml || '<p>لا توجد معاملات.</p>';
}

function closeDebtor() {
    document.getElementById('debtorDetail').style.display = 'none';
    document.getElementById('debtorsMain').style.display = 'block';
    currentActiveDebtorId = null;
}

async function payDebtor() {
    const amount = parseFloat(document.getElementById('debtorPayAmount').value);
    if(!amount || !currentActiveDebtorId) return;

    const debtor = debtors.find(d => d.id === currentActiveDebtorId);
    const newBalance = debtor.balance - amount;
    
    const newTrans = { amount: amount, date: new Date().toISOString() };
    const updatedTransactions = [...(debtor.transactions || []), newTrans];

    await window.updateDoc(window.doc(window.db, "debtors", currentActiveDebtorId), {
        balance: newBalance,
        transactions: updatedTransactions
    });

    document.getElementById('debtorPayAmount').value = '';
    showToast('تم تسجيل التسديد');
}

// --- 11. PWA تثبيت التطبيق ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwa-install-banner').style.display = 'flex';
});

document.getElementById('installBtn').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('pwa-install-banner').style.display = 'none';
        }
        deferredPrompt = null;
    }
});
