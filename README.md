# Internet Archive Downloader

A Next.js application for downloading files and playlists from the Internet Archive to your server.

# Speical thanks
This repo is forked from `https://github.com/john-corcoran/internetarchive-downloader` so a speical thanks to John Corocoran for his hard work

## Features

- Download individual files or entire playlists from Internet Archive
- Filter downloads by file type (MP4, MKV, AVI, etc.)
- Specify custom download paths
- Track download history and status
- Runs on port 9123 by default

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- youtube-dl (for downloading from Internet Archive)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/internet-archive-downloader.git
   cd internet-archive-downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Install youtube-dl (if not already installed):
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install youtube-dl
   
   # On macOS with Homebrew
   brew install yt-dlp
   ```

4. Configure the application:
   - Create a `.env` file in the root directory with the following content:
     ```
     PORT=9123
     DEFAULT_DOWNLOAD_PATH=/mnt/jellyfin/download
     ```
   - Adjust the `DEFAULT_DOWNLOAD_PATH` to your preferred download location

## Usage

### Development Mode

```bash
npm run dev
# or
yarn dev
```

### Production Mode

```bash
npm run build
npm start
# or
yarn build
yarn start
```

The application will be available at `http://your-server-ip:9123`.

## How to Use

1. Enter an Internet Archive URL (e.g., `https://archive.org/details/example`)
2. Select the file types you want to download
3. Specify the download path (defaults to `/mnt/jellyfin/download`)
4. Check the "This is a playlist" option if you want to download all items
5. Click "Download" to start the download process
6. Monitor the download status in the Download History section

## License

MIT
