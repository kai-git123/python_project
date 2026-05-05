from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import price, signals, backtest, advisor

app = FastAPI(title="BTC Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(price.router,    prefix="/api", tags=["price"])
app.include_router(signals.router,  prefix="/api", tags=["signals"])
app.include_router(backtest.router, prefix="/api", tags=["backtest"])
app.include_router(advisor.router,  prefix="/api", tags=["advisor"])

@app.get("/")
def root():
    return {"status": "ok", "message": "BTC Analysis API is running"}
