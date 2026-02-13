# N-Channel Deception Jamming Simulator

An interactive web-based simulator for analyzing N-channel deception-based anti-jamming strategies using Stackelberg game theory. This tool enables researchers and engineers to visualize, validate, and optimize communication strategies in adversarial jamming environments.

## 🎯 Features

### Interactive Playground
- **Real-time Simulation**: Adjust parameters and see immediate results
- **Live Mode**: Automatic re-computation as you modify parameters
- **Visual Analytics**: Interactive charts for channel allocation and transmission rates
- **Parameter Validation**: Built-in constraints to ensure valid configurations

### Parameter Sweep Analysis
- **Multi-dimensional Analysis**: Sweep across power budgets, channel counts, and deception parameters
- **Comparative Visualization**: Heatmaps and line charts for performance metrics
- **Export Capabilities**: Download results as CSV or generate PDF reports
- **Batch Processing**: Analyze multiple configurations simultaneously

### Equilibrium Analysis
- **Nash Equilibrium Computation**: Find optimal strategies for both transmitter and jammer
- **Strategy Visualization**: View equilibrium allocations and power distributions
- **Performance Metrics**: Analyze achievable rates and utility functions
- **Convergence Tracking**: Monitor solution convergence and stability

## 🚀 Getting Started

### Prerequisites

- Node.js v18.0.0 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/spartow/n-channel-6bf509eb.git
cd n-channel-6bf509eb
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:8080`

## 📦 Build & Deploy

### Development Build
```bash
npm run build:dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy to Vercel
1. Push your code to GitHub
2. Import the repository in Vercel
3. Vercel will auto-detect the Vite configuration
4. Deploy with default settings

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Form Handling**: React Hook Form + Zod validation

## 📊 Simulation Parameters

### Transmitter Parameters
- **N**: Total number of channels
- **NR**: Number of real data channels
- **ND**: Number of deception channels
- **PT**: Total transmitter power budget
- **τ**: Minimum power per deception channel

### Jammer Parameters
- **PJ**: Total jammer power budget
- **NJ**: Number of channels the jammer can attack

### Channel Model
- **Random Channel Gains**: Simulates realistic wireless propagation
- **AWGN**: Additive White Gaussian Noise modeling
- **Shannon Capacity**: Information-theoretic rate calculations

## 📖 Usage Guide

### Playground Mode
1. Navigate to the main page
2. Adjust simulation parameters using the control panel
3. Toggle "Live Mode" for automatic updates
4. View results in real-time charts
5. Analyze metrics: achievable rate, jammer utility, and channel allocations

### Sweep Mode
1. Click "Sweep Analysis" in the navigation
2. Configure sweep ranges for PT, N, or ND
3. Set the number of sweep points
4. Run the sweep and analyze heatmaps
5. Export results for further analysis

### Equilibrium Mode
1. Navigate to "Equilibrium Analysis"
2. Set game parameters
3. Compute Nash equilibrium
4. Examine optimal strategies for both players
5. Analyze payoff matrices and best responses

## 🧪 Testing

Run unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## 📝 Project Structure

```
src/
├── components/          # React components
│   ├── layout/         # Header, navigation
│   ├── simulation/     # Simulation-specific components
│   └── ui/            # shadcn/ui components
├── hooks/             # Custom React hooks
├── lib/               # Core simulation logic
├── pages/             # Route pages
│   ├── PlaygroundPage.tsx
│   ├── SweepPage.tsx
│   └── EquilibriumPage.tsx
└── integrations/      # External integrations (Supabase)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🔬 Research Background

This simulator implements the theoretical framework for N-channel deception-based anti-jamming strategies in wireless communications. The Stackelberg game formulation models the strategic interaction between a transmitter (leader) and a jammer (follower), where the transmitter can use deception channels to mislead the jammer's attack strategy.

### Key Concepts
- **Deception Channels**: Dummy transmissions to confuse the jammer
- **Stackelberg Equilibrium**: Sequential game solution concept
- **Power Allocation**: Optimal distribution of transmit power
- **Anti-Jamming**: Strategies to maintain communication under attack

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
