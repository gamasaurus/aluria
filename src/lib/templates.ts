import type { KnowledgeBaseV2 } from '@/lib/types'

export const TEMPLATES: Record<string, { label: string; description: string; kb: KnowledgeBaseV2 }> = {
  'erp-system': {
    label: 'ERP System',
    description: 'Enterprise Resource Planning covering finance, inventory, and HR modules',
    kb: {
      business: {
        problem:
          'The organisation manages finance, inventory, and HR across disconnected spreadsheets and legacy tools, causing data inconsistencies, slow reporting, and manual errors.',
        objectives: [
          'Centralise finance, inventory, and HR data in a single platform',
          'Automate payroll, purchase orders, and financial reporting',
          'Provide real-time dashboards for management decision-making',
        ],
        success_metrics: [
          'Month-end close time reduced by 50 %',
          'Inventory discrepancy rate below 1 %',
          'Payroll processing errors reduced to zero',
        ],
        stakeholders: [
          {
            name: 'Finance Manager',
            goals: ['Accurate financial reporting', 'Faster month-end close'],
            pain_points: ['Manual data entry across multiple spreadsheets', 'Delayed reconciliation'],
          },
          {
            name: 'HR Manager',
            goals: ['Streamlined employee onboarding', 'Automated payroll'],
            pain_points: ['Paper-based leave requests', 'Error-prone manual payroll calculations'],
          },
          {
            name: 'System Admin',
            goals: ['Stable and secure platform', 'Easy user management'],
            pain_points: ['No centralised access control', 'Difficult audit trails'],
          },
        ],
      },
      actors: [
        {
          name: 'Finance Manager',
          description: 'Oversees financial operations, approves budgets, and generates reports',
          permissions: ['view_financials', 'approve_budgets', 'generate_reports', 'manage_accounts'],
          goals: ['Accurate real-time financial data', 'Automated reconciliation'],
        },
        {
          name: 'HR Manager',
          description: 'Manages employee records, leave requests, and payroll processing',
          permissions: ['manage_employees', 'approve_leave', 'run_payroll', 'view_hr_reports'],
          goals: ['Efficient employee lifecycle management', 'Compliant payroll'],
        },
        {
          name: 'System Admin',
          description: 'Configures the platform, manages users, and maintains integrations',
          permissions: ['manage_users', 'configure_modules', 'view_audit_logs', 'manage_integrations'],
          goals: ['System stability', 'Security compliance'],
        },
      ],
      use_cases: {
        normal: [
          {
            title: 'Process Monthly Payroll',
            actor: 'HR Manager',
            steps: [
              'HR Manager navigates to Payroll module',
              'System loads employee records and attendance data',
              'HR Manager reviews calculated salaries and deductions',
              'HR Manager approves payroll run',
              'System generates payslips and triggers bank transfer',
            ],
          },
          {
            title: 'Generate Financial Report',
            actor: 'Finance Manager',
            steps: [
              'Finance Manager selects report type and date range',
              'System aggregates transactions from all modules',
              'Finance Manager reviews the generated report',
              'Finance Manager exports report as PDF or Excel',
            ],
          },
          {
            title: 'Raise Purchase Order',
            actor: 'Finance Manager',
            steps: [
              'Finance Manager creates a new purchase order',
              'System validates budget availability',
              'Finance Manager submits order for approval',
              'System notifies approver and records the pending order',
            ],
          },
        ],
        edge: [
          {
            title: 'Payroll Run with Missing Attendance Data',
            condition: 'Attendance records are incomplete for one or more employees',
            system_response: 'Flag affected employees, block payroll run, and notify HR Manager to resolve gaps',
          },
          {
            title: 'Budget Exceeded on Purchase Order',
            condition: 'Requested purchase amount exceeds available budget',
            system_response: 'Reject the order, display budget shortfall, and suggest alternative approval workflow',
          },
        ],
      },
      process_flow: [
        {
          id: 'step-1',
          actor: 'HR Manager',
          action: 'Initiates payroll run for the current period',
          system: 'Loads employee contracts, attendance, and deduction rules',
          next: 'step-2',
        },
        {
          id: 'step-2',
          actor: 'System',
          action: 'Calculates gross pay, deductions, and net pay for each employee',
          system: 'Applies tax tables and benefit rules',
          next: 'step-3',
        },
        {
          id: 'step-3',
          actor: 'HR Manager',
          action: 'Reviews and approves payroll summary',
          system: 'Locks payroll period and queues bank transfer',
          next: 'step-4',
        },
        {
          id: 'step-4',
          actor: 'System',
          action: 'Disburses salaries and generates payslips',
          system: 'Sends payslip notifications to employees and updates ledger',
          next: '',
        },
      ],
      functional_requirements: [
        {
          id: 'FR-001',
          name: 'Payroll Processing',
          description: 'The system shall calculate and process employee payroll based on contracts, attendance, and deduction rules',
          acceptance_criteria: [
            'Payroll calculates correctly for full-time, part-time, and contract employees',
            'Tax and benefit deductions are applied automatically',
            'Payslips are generated and emailed to employees upon approval',
          ],
        },
        {
          id: 'FR-002',
          name: 'Financial Reporting',
          description: 'The system shall generate profit & loss, balance sheet, and cash flow reports',
          acceptance_criteria: [
            'Reports can be filtered by date range, department, and cost centre',
            'Data is real-time and reflects all posted transactions',
            'Reports can be exported to PDF and Excel',
          ],
        },
        {
          id: 'FR-003',
          name: 'Inventory Tracking',
          description: 'The system shall track stock levels, movements, and reorder points',
          acceptance_criteria: [
            'Stock levels update in real time on goods receipt and dispatch',
            'Low-stock alerts are triggered when quantity falls below reorder point',
            'Full audit trail of all stock movements is maintained',
          ],
        },
      ],
      business_rules: [
        { id: 'BR-001', condition: 'Purchase order amount exceeds approved budget', action: 'Require additional approval from Finance Manager' },
        { id: 'BR-002', condition: 'Employee leave balance is zero', action: 'Block leave request submission and notify HR Manager' },
      ],
      data_model: {
        entities: [],
        relationships: [],
      },
      system_design: {
        architecture: { frontend: '', backend: '', database: '', ai_layer: '' },
        api_endpoints: [],
      },
      ux: {
        user_flow: [],
        screens: [],
      },
      completion: { score: 60, depth: 65 },
    },
  },

  'marketplace': {
    label: 'Online Marketplace',
    description: 'Multi-sided marketplace connecting buyers and sellers with product listings and order management',
    kb: {
      business: {
        problem:
          'Buyers struggle to discover and purchase products from multiple sellers in one place, while sellers lack a unified platform to list products, manage orders, and track revenue.',
        objectives: [
          'Provide a single platform for buyers to browse and purchase from multiple sellers',
          'Enable sellers to manage listings, inventory, and payouts',
          'Ensure secure payments and dispute resolution',
        ],
        success_metrics: [
          'Gross Merchandise Value (GMV) grows 20 % month-over-month',
          'Seller onboarding time under 10 minutes',
          'Buyer checkout abandonment rate below 15 %',
        ],
        stakeholders: [
          {
            name: 'Buyer',
            goals: ['Find products quickly', 'Secure and easy checkout'],
            pain_points: ['Too many platforms to check', 'Unclear seller reputation'],
          },
          {
            name: 'Seller',
            goals: ['Reach more customers', 'Simple order management'],
            pain_points: ['Complex listing process', 'Delayed payouts'],
          },
          {
            name: 'Admin',
            goals: ['Platform integrity', 'Revenue growth'],
            pain_points: ['Fraudulent listings', 'Dispute resolution overhead'],
          },
        ],
      },
      actors: [
        {
          name: 'Buyer',
          description: 'Registered user who browses, adds to cart, and purchases products',
          permissions: ['browse_listings', 'add_to_cart', 'checkout', 'leave_review', 'raise_dispute'],
          goals: ['Discover products easily', 'Receive orders on time'],
        },
        {
          name: 'Seller',
          description: 'Registered merchant who lists products, manages inventory, and fulfils orders',
          permissions: ['create_listing', 'manage_inventory', 'view_orders', 'process_shipment', 'view_payouts'],
          goals: ['Maximise sales', 'Efficient order fulfilment'],
        },
        {
          name: 'Admin',
          description: 'Platform operator who moderates listings, resolves disputes, and manages commissions',
          permissions: ['moderate_listings', 'manage_users', 'resolve_disputes', 'configure_commissions', 'view_analytics'],
          goals: ['Platform trust and safety', 'Revenue optimisation'],
        },
      ],
      use_cases: {
        normal: [
          {
            title: 'Purchase a Product',
            actor: 'Buyer',
            steps: [
              'Buyer searches for a product by keyword or category',
              'Buyer views product detail page and seller rating',
              'Buyer adds product to cart',
              'Buyer proceeds to checkout and selects payment method',
              'System processes payment and confirms order to buyer and seller',
            ],
          },
          {
            title: 'List a New Product',
            actor: 'Seller',
            steps: [
              'Seller navigates to Seller Dashboard and clicks "Add Listing"',
              'Seller fills in product title, description, price, and uploads images',
              'Seller sets stock quantity and shipping options',
              'Seller submits listing for review',
              'System publishes listing after automated moderation check',
            ],
          },
          {
            title: 'Resolve a Dispute',
            actor: 'Admin',
            steps: [
              'Buyer raises a dispute on an order',
              'System notifies Admin and Seller',
              'Admin reviews evidence from both parties',
              'Admin issues resolution (refund, replacement, or rejection)',
              'System applies resolution and notifies both parties',
            ],
          },
        ],
        edge: [
          {
            title: 'Payment Failure at Checkout',
            condition: 'Payment gateway returns a failure response',
            system_response: 'Display error message, retain cart contents, and prompt buyer to retry or use alternative payment method',
          },
          {
            title: 'Out-of-Stock After Cart Add',
            condition: 'Product stock reaches zero between cart add and checkout',
            system_response: 'Notify buyer at checkout, remove item from cart, and suggest similar products',
          },
        ],
      },
      process_flow: [
        {
          id: 'step-1',
          actor: 'Buyer',
          action: 'Searches for product and adds to cart',
          system: 'Validates stock availability and reserves quantity',
          next: 'step-2',
        },
        {
          id: 'step-2',
          actor: 'Buyer',
          action: 'Enters shipping address and selects payment method',
          system: 'Calculates shipping cost and applies any discount codes',
          next: 'step-3',
        },
        {
          id: 'step-3',
          actor: 'System',
          action: 'Processes payment via payment gateway',
          system: 'Captures payment and creates order record',
          next: 'step-4',
        },
        {
          id: 'step-4',
          actor: 'Seller',
          action: 'Receives order notification and prepares shipment',
          system: 'Updates order status and notifies buyer of dispatch',
          next: '',
        },
      ],
      functional_requirements: [
        {
          id: 'FR-001',
          name: 'Product Listing Management',
          description: 'Sellers shall be able to create, edit, and remove product listings with images, pricing, and stock levels',
          acceptance_criteria: [
            'Listings support multiple images and rich text descriptions',
            'Price and stock updates reflect immediately on the buyer-facing page',
            'Removed listings are hidden from search but retained for order history',
          ],
        },
        {
          id: 'FR-002',
          name: 'Checkout and Payment',
          description: 'The system shall support secure checkout with multiple payment methods and order confirmation',
          acceptance_criteria: [
            'Checkout supports credit/debit card and digital wallet payments',
            'Order confirmation email is sent to buyer within 60 seconds of payment',
            'Payment is held in escrow until delivery is confirmed',
          ],
        },
        {
          id: 'FR-003',
          name: 'Seller Payout',
          description: 'The system shall calculate and disburse seller payouts after deducting platform commission',
          acceptance_criteria: [
            'Payouts are calculated automatically after order delivery confirmation',
            'Commission rate is configurable per product category',
            'Sellers can view payout history and pending balances in their dashboard',
          ],
        },
      ],
      business_rules: [
        { id: 'BR-001', condition: 'Order is not delivered within the estimated window', action: 'Automatically trigger a buyer notification and flag order for Admin review' },
        { id: 'BR-002', condition: 'Seller dispute rate exceeds 5 % in 30 days', action: 'Suspend seller account pending Admin review' },
      ],
      data_model: {
        entities: [],
        relationships: [],
      },
      system_design: {
        architecture: { frontend: '', backend: '', database: '', ai_layer: '' },
        api_endpoints: [],
      },
      ux: {
        user_flow: [],
        screens: [],
      },
      completion: { score: 60, depth: 65 },
    },
  },

  'hr-system': {
    label: 'HR Management System',
    description: 'Human Resources platform for employee records, leave management, and payroll',
    kb: {
      business: {
        problem:
          'HR processes are fragmented across email, spreadsheets, and paper forms, making it difficult to maintain accurate employee records, process leave requests promptly, and run compliant payroll.',
        objectives: [
          'Centralise employee records and document management',
          'Automate leave request and approval workflows',
          'Streamline payroll processing and compliance reporting',
        ],
        success_metrics: [
          'Leave request approval time reduced from 3 days to same day',
          'Payroll processing time reduced by 60 %',
          'HR data accuracy rate above 99 %',
        ],
        stakeholders: [
          {
            name: 'HR Manager',
            goals: ['Accurate employee data', 'Efficient HR workflows'],
            pain_points: ['Manual data entry', 'Lost paper forms'],
          },
          {
            name: 'Employee',
            goals: ['Easy leave requests', 'Transparent payslip access'],
            pain_points: ['Unclear leave balances', 'Delayed payslip delivery'],
          },
          {
            name: 'Payroll Admin',
            goals: ['Accurate and timely payroll', 'Compliance with tax regulations'],
            pain_points: ['Manual salary calculations', 'Reconciliation errors'],
          },
        ],
      },
      actors: [
        {
          name: 'HR Manager',
          description: 'Manages employee lifecycle, approves leave, and oversees HR operations',
          permissions: ['manage_employees', 'approve_leave', 'view_all_records', 'generate_hr_reports', 'manage_org_structure'],
          goals: ['Complete and accurate employee data', 'Efficient HR service delivery'],
        },
        {
          name: 'Employee',
          description: 'Staff member who submits leave requests, views payslips, and updates personal details',
          permissions: ['submit_leave', 'view_own_payslips', 'update_personal_details', 'view_leave_balance'],
          goals: ['Quick leave approvals', 'Easy access to HR information'],
        },
        {
          name: 'Payroll Admin',
          description: 'Processes payroll, manages deductions, and ensures tax compliance',
          permissions: ['run_payroll', 'manage_deductions', 'view_all_payroll', 'generate_tax_reports', 'manage_salary_structures'],
          goals: ['Error-free payroll', 'Regulatory compliance'],
        },
      ],
      use_cases: {
        normal: [
          {
            title: 'Submit Leave Request',
            actor: 'Employee',
            steps: [
              'Employee logs in and navigates to Leave Management',
              'Employee selects leave type and date range',
              'System checks available leave balance',
              'Employee submits request with optional notes',
              'System notifies HR Manager for approval',
            ],
          },
          {
            title: 'Approve Leave Request',
            actor: 'HR Manager',
            steps: [
              'HR Manager receives leave request notification',
              'HR Manager reviews request and team calendar',
              'HR Manager approves or rejects with comments',
              'System updates leave balance and notifies employee',
            ],
          },
          {
            title: 'Run Monthly Payroll',
            actor: 'Payroll Admin',
            steps: [
              'Payroll Admin initiates payroll for the current month',
              'System aggregates attendance, leave, and deduction data',
              'Payroll Admin reviews and adjusts exceptions',
              'Payroll Admin approves payroll run',
              'System generates payslips and triggers salary disbursement',
            ],
          },
        ],
        edge: [
          {
            title: 'Leave Request Exceeds Balance',
            condition: 'Requested leave days exceed the employee\'s available balance',
            system_response: 'Block submission, display remaining balance, and offer option to apply for unpaid leave',
          },
          {
            title: 'Payroll Run with Pending Leave Adjustments',
            condition: 'Unapproved leave requests exist for the payroll period',
            system_response: 'Warn Payroll Admin, list pending requests, and require resolution before finalising payroll',
          },
        ],
      },
      process_flow: [
        {
          id: 'step-1',
          actor: 'Employee',
          action: 'Submits leave request via self-service portal',
          system: 'Validates leave balance and checks for scheduling conflicts',
          next: 'step-2',
        },
        {
          id: 'step-2',
          actor: 'HR Manager',
          action: 'Reviews leave request in approval queue',
          system: 'Displays team calendar and leave history for context',
          next: 'step-3',
        },
        {
          id: 'step-3',
          actor: 'HR Manager',
          action: 'Approves or rejects the leave request',
          system: 'Updates leave balance, notifies employee, and records decision',
          next: 'step-4',
        },
        {
          id: 'step-4',
          actor: 'Payroll Admin',
          action: 'Runs payroll incorporating approved leave and attendance',
          system: 'Calculates net pay, generates payslips, and disburses salaries',
          next: '',
        },
      ],
      functional_requirements: [
        {
          id: 'FR-001',
          name: 'Employee Record Management',
          description: 'The system shall maintain comprehensive employee profiles including personal details, contracts, and documents',
          acceptance_criteria: [
            'Employee profiles store personal, contract, and emergency contact information',
            'Document uploads (contracts, certificates) are supported with version history',
            'Changes to employee records are logged with timestamp and editor identity',
          ],
        },
        {
          id: 'FR-002',
          name: 'Leave Management',
          description: 'The system shall manage leave types, balances, requests, and approvals',
          acceptance_criteria: [
            'Multiple leave types (annual, sick, unpaid) are configurable',
            'Leave balances update in real time upon approval',
            'Employees receive notifications at each stage of the approval workflow',
          ],
        },
        {
          id: 'FR-003',
          name: 'Payroll Processing',
          description: 'The system shall calculate and process payroll with tax and benefit deductions',
          acceptance_criteria: [
            'Payroll engine applies current tax tables and statutory deductions automatically',
            'Payslips are generated in PDF format and accessible via employee self-service',
            'Payroll reports are exportable for bank submission and tax filing',
          ],
        },
      ],
      business_rules: [
        { id: 'BR-001', condition: 'Employee has been with the company less than 3 months', action: 'Restrict annual leave requests until probation period ends' },
        { id: 'BR-002', condition: 'Leave request overlaps with a public holiday', action: 'Exclude public holidays from leave day count automatically' },
      ],
      data_model: {
        entities: [],
        relationships: [],
      },
      system_design: {
        architecture: { frontend: '', backend: '', database: '', ai_layer: '' },
        api_endpoints: [],
      },
      ux: {
        user_flow: [],
        screens: [],
      },
      completion: { score: 60, depth: 65 },
    },
  },

  'inventory': {
    label: 'Inventory Management',
    description: 'Stock tracking, purchase orders, and supplier management for warehouses',
    kb: {
      business: {
        problem:
          'Warehouse operations rely on manual stock counts and disconnected spreadsheets, leading to stockouts, overstock situations, and delayed procurement decisions.',
        objectives: [
          'Provide real-time visibility into stock levels across all locations',
          'Automate reorder triggers and purchase order creation',
          'Streamline supplier management and goods receipt processes',
        ],
        success_metrics: [
          'Stockout incidents reduced by 80 %',
          'Inventory accuracy above 98 % (verified by cycle counts)',
          'Purchase order processing time reduced by 70 %',
        ],
        stakeholders: [
          {
            name: 'Warehouse Manager',
            goals: ['Accurate stock levels', 'Efficient goods receipt'],
            pain_points: ['Manual stock counts', 'Discrepancies between physical and system stock'],
          },
          {
            name: 'Procurement Officer',
            goals: ['Timely purchase orders', 'Supplier performance visibility'],
            pain_points: ['Reactive purchasing due to lack of alerts', 'Manual PO creation'],
          },
          {
            name: 'System',
            goals: ['Automated reorder and alerting', 'Data integrity'],
            pain_points: [],
          },
        ],
      },
      actors: [
        {
          name: 'Warehouse Manager',
          description: 'Oversees stock movements, goods receipt, and physical inventory counts',
          permissions: ['receive_goods', 'dispatch_stock', 'conduct_stock_count', 'view_stock_levels', 'manage_locations'],
          goals: ['Accurate real-time stock data', 'Efficient warehouse operations'],
        },
        {
          name: 'Procurement Officer',
          description: 'Creates and manages purchase orders and supplier relationships',
          permissions: ['create_purchase_order', 'manage_suppliers', 'approve_purchase_order', 'view_procurement_reports'],
          goals: ['Prevent stockouts', 'Optimise procurement costs'],
        },
        {
          name: 'System',
          description: 'Automated processes for reorder alerts, stock calculations, and integrations',
          permissions: ['trigger_reorder_alert', 'update_stock_levels', 'generate_reports', 'send_notifications'],
          goals: ['Data accuracy', 'Proactive alerting'],
        },
      ],
      use_cases: {
        normal: [
          {
            title: 'Receive Goods from Supplier',
            actor: 'Warehouse Manager',
            steps: [
              'Warehouse Manager opens the expected purchase order in the system',
              'Warehouse Manager scans or enters received item quantities',
              'System compares received quantities against PO',
              'Warehouse Manager confirms receipt and notes any discrepancies',
              'System updates stock levels and closes or partially fulfils the PO',
            ],
          },
          {
            title: 'Create Purchase Order',
            actor: 'Procurement Officer',
            steps: [
              'Procurement Officer selects supplier and items to order',
              'System suggests quantities based on reorder points and lead times',
              'Procurement Officer reviews and adjusts quantities',
              'Procurement Officer submits PO for approval',
              'System sends PO to supplier upon approval',
            ],
          },
          {
            title: 'Conduct Stock Count',
            actor: 'Warehouse Manager',
            steps: [
              'Warehouse Manager initiates a cycle count for a product category',
              'System generates a count sheet with expected quantities',
              'Warehouse Manager records physical counts',
              'System highlights discrepancies between expected and actual counts',
              'Warehouse Manager approves adjustments to reconcile stock',
            ],
          },
        ],
        edge: [
          {
            title: 'Received Quantity Exceeds PO Quantity',
            condition: 'Goods receipt quantity is greater than the purchase order quantity',
            system_response: 'Flag over-receipt, require Warehouse Manager confirmation, and create a discrepancy record for Procurement Officer review',
          },
          {
            title: 'Reorder Point Triggered for Discontinued Item',
            condition: 'Stock falls below reorder point for an item marked as discontinued',
            system_response: 'Suppress reorder alert, notify Procurement Officer, and suggest substitution items',
          },
        ],
      },
      process_flow: [
        {
          id: 'step-1',
          actor: 'System',
          action: 'Detects stock level below reorder point',
          system: 'Generates reorder alert and notifies Procurement Officer',
          next: 'step-2',
        },
        {
          id: 'step-2',
          actor: 'Procurement Officer',
          action: 'Reviews alert and creates purchase order',
          system: 'Suggests order quantity based on lead time and demand history',
          next: 'step-3',
        },
        {
          id: 'step-3',
          actor: 'Procurement Officer',
          action: 'Approves and sends purchase order to supplier',
          system: 'Records PO and sets expected delivery date',
          next: 'step-4',
        },
        {
          id: 'step-4',
          actor: 'Warehouse Manager',
          action: 'Receives goods and confirms quantities in system',
          system: 'Updates stock levels and closes PO',
          next: '',
        },
      ],
      functional_requirements: [
        {
          id: 'FR-001',
          name: 'Real-Time Stock Tracking',
          description: 'The system shall maintain accurate real-time stock levels across all warehouse locations',
          acceptance_criteria: [
            'Stock levels update immediately on goods receipt, dispatch, and adjustment',
            'Stock is tracked per SKU, location, and batch/lot number',
            'Historical stock movement log is available for audit purposes',
          ],
        },
        {
          id: 'FR-002',
          name: 'Automated Reorder Alerts',
          description: 'The system shall automatically trigger reorder alerts when stock falls below configurable reorder points',
          acceptance_criteria: [
            'Reorder points are configurable per SKU',
            'Alerts are sent to Procurement Officer via email and in-app notification',
            'Alert history is logged with timestamp and stock level at trigger',
          ],
        },
        {
          id: 'FR-003',
          name: 'Purchase Order Management',
          description: 'The system shall support creation, approval, and tracking of purchase orders',
          acceptance_criteria: [
            'POs can be created manually or auto-generated from reorder alerts',
            'PO approval workflow is configurable by order value threshold',
            'PO status (draft, sent, partially received, closed) is tracked in real time',
          ],
        },
      ],
      business_rules: [
        { id: 'BR-001', condition: 'Purchase order value exceeds $10,000', action: 'Require secondary approval from Finance Manager before sending to supplier' },
        { id: 'BR-002', condition: 'Supplier delivery is more than 3 days late', action: 'Automatically flag supplier performance record and notify Procurement Officer' },
      ],
      data_model: {
        entities: [],
        relationships: [],
      },
      system_design: {
        architecture: { frontend: '', backend: '', database: '', ai_layer: '' },
        api_endpoints: [],
      },
      ux: {
        user_flow: [],
        screens: [],
      },
      completion: { score: 60, depth: 65 },
    },
  },
}
