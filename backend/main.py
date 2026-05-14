from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os_tools

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for development, consider securing in prod)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CommandRequest(BaseModel):
    command_type: str
    target: str

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "Python backend is running!"}

@app.post("/execute")
def execute(req: CommandRequest):
    result = os_tools.execute_os_command(req.command_type, req.target)
    return {"status": "success", "message": result}

if __name__ == "__main__":
    import uvicorn
    # Run the server on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
