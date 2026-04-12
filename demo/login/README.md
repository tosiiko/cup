# Python Login Demo

This demo shows a simple login flow powered by the CUP Python adapter.

## What it does

- Serves a small HTML shell from Python
- Fetches a CUP `UIView` from the backend
- Mounts the view with the CUP runtime from `dist/`
- Uses CUP `emit` actions to trigger login and reset events
- Posts form values back to Python and remounts the returned CUP view

## Run

Build the runtime first:

```bash
npm run build
```

Then start the demo:

```bash
python3 demo/login/server.py
```

Open [http://localhost:8010](http://localhost:8010).

## Demo credentials

- Username: `demo`
- Password: `cup123`
