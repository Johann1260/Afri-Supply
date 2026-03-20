import requests
import sys
from datetime import datetime
import json

class AfriSupplyAPITester:
    def __init__(self, base_url="https://supply-connect-40.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and len(str(response_data)) < 200:
                        print(f"   Response: {response_data}")
                    elif isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text and response.text.strip() else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health endpoint"""
        return self.run_test("Health Check", "GET", "api/health", 200)

    def test_seed_data(self):
        """Test seeding initial data"""
        return self.run_test("Seed Data", "POST", "api/seed", 200)

    def test_get_categories(self):
        """Test getting categories"""
        return self.run_test("Get Categories", "GET", "api/categories", 200)

    def test_get_products(self):
        """Test getting products"""
        return self.run_test("Get Products", "GET", "api/products", 200)

    def test_get_popular_products(self):
        """Test getting popular products"""
        return self.run_test("Get Popular Products", "GET", "api/products/popular", 200)

    def test_login_buyer(self):
        """Test buyer login"""
        success, response = self.run_test(
            "Login Buyer",
            "POST",
            "api/auth/login",
            200,
            data={"email": "buyer@afrisupply.com", "password": "buyer123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained for user: {response.get('user', {}).get('full_name')}")
            return True
        return False

    def test_login_supplier(self):
        """Test supplier login"""
        success, response = self.run_test(
            "Login Supplier",
            "POST",
            "api/auth/login",
            200,
            data={"email": "supplier@afrisupply.com", "password": "supplier123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained for user: {response.get('user', {}).get('full_name')}")
            return True
        return False

    def test_get_me(self):
        """Test getting current user info"""
        return self.run_test("Get Current User", "GET", "api/auth/me", 200)

    def test_get_cart(self):
        """Test getting user cart"""
        return self.run_test("Get Cart", "GET", "api/cart", 200)

    def test_add_to_cart(self, product_id):
        """Test adding product to cart"""
        return self.run_test(
            "Add to Cart",
            "POST",
            "api/cart/items",
            200,
            data={"product_id": product_id, "quantity": 2}
        )

    def test_get_orders(self):
        """Test getting user orders"""
        return self.run_test("Get Orders", "GET", "api/orders", 200)

    def test_get_supplier_products(self):
        """Test getting supplier's products"""
        return self.run_test("Get Supplier Products", "GET", "api/supplier/products", 200)

    def test_get_supplier_stats(self):
        """Test getting supplier stats"""
        return self.run_test("Get Supplier Stats", "GET", "api/supplier/stats", 200)

    def test_get_favorites(self):
        """Test getting user favorites"""
        return self.run_test("Get Favorites", "GET", "api/favorites", 200)

    def test_get_rfqs(self):
        """Test getting RFQs"""
        return self.run_test("Get RFQs", "GET", "api/rfq", 200)

    def test_create_rfq(self, product_id, supplier_id):
        """Test creating an RFQ"""
        return self.run_test(
            "Create RFQ",
            "POST",
            "api/rfq",
            200,
            data={
                "product_id": product_id,
                "supplier_id": supplier_id,
                "quantity": 10,
                "target_price": 50000,
                "delivery_location": "Douala, Cameroun",
                "delivery_deadline": "2025-02-15",
                "specifications": "Test specifications",
                "notes": "Test RFQ notes"
            }
        )

    def test_get_notifications(self):
        """Test getting notifications"""
        return self.run_test("Get Notifications", "GET", "api/notifications", 200)

    def test_get_unread_count(self):
        """Test getting unread notifications count"""
        return self.run_test("Get Unread Count", "GET", "api/notifications/unread-count", 200)

    def test_get_conversations(self):
        """Test getting message conversations"""
        return self.run_test("Get Conversations", "GET", "api/messages/conversations", 200)

    def test_send_message(self, receiver_id):
        """Test sending a message"""
        return self.run_test(
            "Send Message",
            "POST",
            "api/messages",
            200,
            data={
                "receiver_id": receiver_id,
                "content": "Test message from API test"
            }
        )

    def test_mobile_money_payment(self):
        """Test mobile money payment creation (MOCKED)"""
        return self.run_test(
            "Create Mobile Money Payment",
            "POST",
            "api/checkout/mobile-money",
            200,
            data={
                "phone_number": "+237612345678",
                "network": "MTN",
                "country_code": "CM"
            }
        )

    def test_get_suppliers(self):
        """Test getting suppliers list"""
        return self.run_test("Get Suppliers", "GET", "api/suppliers", 200)

    def test_get_supplier_profile(self, supplier_id):
        """Test getting supplier profile"""
        return self.run_test("Get Supplier Profile", "GET", f"api/suppliers/{supplier_id}/profile", 200)

    def test_get_supplier_ratings(self, supplier_id):
        """Test getting supplier ratings"""
        return self.run_test("Get Supplier Ratings", "GET", f"api/suppliers/{supplier_id}/ratings", 200)

    def test_create_order_without_shipping(self):
        """Test creating order without shipping fields"""
        return self.run_test(
            "Create Order (No Shipping)",
            "POST",
            "api/orders",
            200,
            data={
                "payment_method": "stripe",
                "notes": "Test order without shipping"
            }
        )

def main():
    print("🚀 Starting AfriSupply API Tests")
    print("=" * 50)
    
    tester = AfriSupplyAPITester()
    
    # Test basic endpoints
    print("\n📋 Testing Basic Endpoints")
    tester.test_health_check()
    tester.test_seed_data()
    tester.test_get_categories()
    tester.test_get_products()
    tester.test_get_popular_products()
    
    # Test buyer authentication and features
    print("\n👤 Testing Buyer Authentication & Features")
    buyer_product_id = None
    supplier_id = None
    
    if tester.test_login_buyer():
        tester.test_get_me()
        tester.test_get_cart()
        tester.test_get_orders()
        tester.test_get_favorites()
        
        # Test adding to cart (get first product)
        success, products = tester.run_test("Get Products for Cart Test", "GET", "api/products?limit=1", 200)
        if success and products and len(products) > 0:
            buyer_product_id = products[0]['id']
            supplier_id = products[0].get('supplier_id')
            tester.test_add_to_cart(buyer_product_id)
        
        # Test new features for buyer
        print("\n🆕 Testing New Features (Buyer)")
        tester.test_get_notifications()
        tester.test_get_unread_count()
        tester.test_get_conversations()
        tester.test_get_rfqs()
        
        # Test RFQ creation if we have product and supplier
        if buyer_product_id and supplier_id:
            tester.test_create_rfq(buyer_product_id, supplier_id)
        
        # Test mobile money payment (MOCKED)
        tester.test_mobile_money_payment()
        
        # Test sending message if we have supplier
        if supplier_id:
            tester.test_send_message(supplier_id)
        
        # Test new supplier-related endpoints
        print("\n🏪 Testing Supplier-Related Features")
        tester.test_get_suppliers()
        if supplier_id:
            tester.test_get_supplier_profile(supplier_id)
            tester.test_get_supplier_ratings(supplier_id)
        
        # Test order creation without shipping
        tester.test_create_order_without_shipping()
    
    # Reset token for supplier tests
    tester.token = None
    
    # Test supplier authentication and features
    print("\n🏭 Testing Supplier Authentication & Features")
    if tester.test_login_supplier():
        tester.test_get_me()
        tester.test_get_supplier_products()
        tester.test_get_supplier_stats()
        
        # Test new features for supplier
        print("\n🆕 Testing New Features (Supplier)")
        tester.test_get_notifications()
        tester.test_get_conversations()
        tester.test_get_rfqs()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())