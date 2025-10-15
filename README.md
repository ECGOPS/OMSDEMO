# ECG NMS - Power Distribution Asset Management System

## Overview
ECG NMS is a comprehensive asset management and fault tracking system designed for power distribution networks. It provides real-time asset inspection, fault tracking, advanced analytics, and detailed reporting capabilities for utility companies and power distribution operators.

## Key Features

### Asset Management
- **Overhead Line Inspections**
  - Comprehensive pole condition assessment
  - Stay, cross arm, and insulator condition tracking
  - Conductor and lightning arrester inspection
  - Detailed condition reporting with images
  - PDF and CSV export capabilities

- **Substation Inspections**
  - Transformer condition monitoring
  - Switchgear and protection device inspection
  - Detailed equipment condition reporting

- **Load Monitoring**
  - Real-time load tracking
  - Peak demand analysis
  - Load balancing recommendations

### Fault Management
- Real-time fault tracking and management
- Advanced analytics and reporting
- MTTR (Mean Time To Repair) analysis
- Reliability indices calculation (SAIDI, SAIFI, CAIDI)

### User Management
- Multi-level user roles and permissions
- Geographic region and district management
- User activity tracking and audit logs

### Reporting
- Detailed inspection reports
- Fault analysis reports
- Performance metrics
- Export to PDF and CSV formats
- Custom report generation

## Technical Stack
- **Frontend**: React, TypeScript, Tailwind CSS
- **State Management**: React Context
- **UI Components**: Shadcn UI
- **Charts**: Recharts
- **PDF Generation**: jsPDF, jspdf-autotable
- **Date Handling**: date-fns
- **Form Handling**: React Hook Form
- **Data Validation**: Zod
- **Icons**: Lucide React

## System Requirements
- Node.js 16.x or higher
- npm 7.x or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ECGOPS/NMS.git
   cd NMS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   # Required variables:
   # - Firebase configuration
   # - Application settings
   # - Security settings
   # - Service-specific settings (if applicable)
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## Security Considerations
- All sensitive data is stored in environment variables
- HTTPS is enforced in production
- Security headers are configured for protection against common web vulnerabilities
- Rate limiting is implemented for API endpoints
- Session management includes secure cookie settings
- Password hashing and validation follow security best practices
- CORS is properly configured
- Content Security Policy (CSP) is implemented

## Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── overhead-line/  # Overhead line inspection components
│   ├── substation/     # Substation inspection components
│   ├── load-monitoring/# Load monitoring components
│   └── shared/         # Shared components
├── contexts/           # React contexts for state management
├── lib/               # Utility functions and types
├── pages/             # Application pages
├── utils/             # Helper functions
└── data/              # JSON data files
```

## Documentation
- [User Guide](docs/user-guide.md)
- [Technical Documentation](docs/technical.md)
- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License
Proprietary - All rights reserved

## Support
For support and inquiries, please contact:
- Email: afiifi@ecggh.com
- Phone: +233245003731

# OPSNMS

Test sync with NMSDEMO repository.
