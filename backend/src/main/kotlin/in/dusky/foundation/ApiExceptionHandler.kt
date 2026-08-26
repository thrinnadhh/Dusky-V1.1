package `in`.dusky.foundation

import org.springframework.context.annotation.Profile
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import java.util.UUID

fun interface TraceIdProvider { fun next(): String }

@RestControllerAdvice
class ApiExceptionHandler(private val traceIdProvider: TraceIdProvider) {
    @ExceptionHandler(IllegalArgumentException::class)
    fun invalidRequest(exception: IllegalArgumentException): ResponseEntity<ErrorEnvelope> =
        ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            ErrorEnvelope(ErrorBody("VALIDATION_ERROR", exception.message ?: "Invalid request", traceIdProvider.next())),
        )
}

@org.springframework.context.annotation.Configuration
class TraceConfiguration {
    @org.springframework.context.annotation.Bean
    @Profile("!test")
    fun traceIdProvider(): TraceIdProvider = TraceIdProvider { UUID.randomUUID().toString() }

    @org.springframework.context.annotation.Bean
    @Profile("test")
    fun testTraceIdProvider(): TraceIdProvider = TraceIdProvider { "trace-test-fixed" }
}

