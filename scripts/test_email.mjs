
import { sendAdminOrderNotification } from '../src/lib/email.js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testEmail() {
    console.log('--- Testing Admin Order Notification ---')
    const result = await sendAdminOrderNotification('jeon28in@gmail.com', {
        orderId: 'TEST-ORD-123',
        productName: 'Tidal Test',
        planName: '12 Months',
        amount: 60000,
        buyerName: 'Tester',
        buyerPhone: '010-0000-0000',
        depositorName: 'Tester'
    })

    console.log('Result:', JSON.stringify(result, null, 2))
}

testEmail()
