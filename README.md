# Internet Archive Downloader

A web application for downloading content from the Internet Archive.

## Features

- Add Internet Archive URLs to a download queue
- Monitor download progress
- Automatically download files to a specified destination

## Technologies Used

- Next.js 14 with App Router
- React 18
- TypeScript
- Tailwind CSS
- pnpm (Package Manager)
- Jest and React Testing Library for testing

## Prerequisites

- Node.js 18 or higher
- pnpm package manager

## Installation

1. Install pnpm if you don't have it already:

```bash
npm install -g pnpm
```

2. Clone the repository:

```bash
git clone https://github.com/yourusername/internet-archive-downloader.git
cd internet-archive-downloader
```

3. Install dependencies:

```bash
pnpm install
```

## Development

Start the development server:

```bash
pnpm dev
```

The application will be available at http://localhost:3000.

## Building for Production

Build the application:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

## Testing

Run all tests:

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test:watch
```

Run tests with coverage report:

```bash
pnpm test:coverage
```

Run specific test suites:

```bash
# Run only component tests
pnpm test:components

# Run only app tests
pnpm test:app
```

## Project Structure

- `src/app`: Next.js app router pages and API routes
- `src/components`: React components
- `src/lib`: Utility functions and shared code
- `src/server`: Server-side code for downloading files
- `src/__tests__`: Test files organized by component/feature

## License

MIT
