package `in`.dusky.foundation

data class ErrorEnvelope(val error: ErrorBody)

data class ErrorBody(
    val code: String,
    val message: String,
    val traceId: String,
    val details: Map<String, Any>? = null,
)

